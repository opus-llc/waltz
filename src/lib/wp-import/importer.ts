import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { DB } from "../../db/connect";
import * as schema from "../../db/schema";
import { BASE_PATH } from "../base-path";
import { isValidSlug } from "../format";
import { collidesWithOwnRoute, normalizeLegacyPath } from "../legacy-path";
import { hashPassword } from "../password";
import { newUploadFilename } from "../image-sniff";
import { convertContent, htmlToPlain, type Issue } from "./convert";
import { fetchImage, type FetchedImage } from "./fetch-image";
import type { WxrData, WxrItem } from "./parse";

export type ImportOptions = {
  /** 同じスラッグの記事が既にあるとき。rename: 末尾に -2 などを付けて取り込む / skip: 取り込まない（既存記事は上書きしない） */
  onSlugConflict: "rename" | "skip";
  /** WordPress の投稿者（ログイン名）→ 紐付ける既存ユーザーの ID、または "create"（ログインできない編集者として作成） */
  authorMap: Record<string, number | "create">;
  /** 元サイトから画像を取得して保存する */
  downloadImages: boolean;
  /** 「要確認」がある記事は下書きで取り込む */
  draftIfIssues: boolean;
  /** 承認済みコメントを、このコミュニティへ「記事の共有投稿＋コメント」として移す（null なら移さない） */
  commentsCommunityId: number | null;
};

export const DEFAULT_OPTIONS: ImportOptions = {
  onSlugConflict: "skip",
  authorMap: {},
  downloadImages: true,
  draftIfIssues: false,
  commentsCommunityId: null,
};

export type PlanArticle = {
  wpId: number;
  type: "post" | "page";
  title: string;
  wpStatus: string;
  status: "published" | "draft";
  future: boolean;
  slug: string;
  originalSlug: string;
  slugChanged: boolean;
  action: "create" | "rename" | "skip";
  newPath: string;
  oldPaths: string[];
  author: string;
  issues: Issue[];
  images: number;
  comments: number;
};

export type DryRunReport = {
  site: { title: string; url: string };
  counts: {
    posts: number;
    pages: number;
    published: number;
    drafts: number;
    future: number;
    attachments: number;
    comments: number;
    images: number;
    redirects: number;
    newCategories: number;
    newTags: number;
    conflicts: number;
    slugChanged: number;
    withIssues: number;
  };
  authors: Array<{ login: string; displayName: string; email: string; articles: number; mappedTo: number | "create"; matchedUser: string | null }>;
  articles: PlanArticle[];
  issueSummary: Array<{ kind: Issue["kind"]; label: string; articles: string[] }>;
  notImported: Array<{ label: string; count: number }>;
  skippedRedirects: string[];
  warnings: string[];
};

export type ImportResult = {
  created: { posts: number; pages: number; users: number; categories: number; tags: number; redirects: number; communityPosts: number; comments: number };
  skipped: Array<{ title: string; reason: string }>;
  images: { downloaded: number; failed: Array<{ url: string; reason: string; articles: string[] }> };
  articles: Array<{ title: string; path: string; status: "published" | "draft" }>;
};

type Prepared = {
  report: DryRunReport;
  articles: Array<{
    plan: PlanArticle;
    item: WxrItem;
    markdown: string;
    excerpt: string;
    coverUrl: string;
    coverAlt: string;
    images: string[];
    categoryKey: string | null;
    tagNames: string[];
    seoTitle: string;
    seoDescription: string;
  }>;
  categories: Map<string, { name: string; slug: string; existingId: number | null }>;
  redirects: Array<{ from: string; to: string }>;
  opts: ImportOptions;
};

const IMPORT_TYPES = new Set(["post", "page"]);
const STATUS_MAP: Record<string, { status: "published" | "draft"; future?: boolean } | undefined> = {
  publish: { status: "published" },
  future: { status: "published", future: true },
  draft: { status: "draft" },
  pending: { status: "draft" },
  private: { status: "draft" },
};

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 英数字だけを取り出したスラッグ（日本語は落ちる） */
const asciiSlug = (s: string, max = 60) =>
  s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");

/** waltz の URL 規則（半角英小文字・数字・ハイフン）に合う形へ。合わなければ英数字部分＋WordPress の ID */
function baseSlug(item: WxrItem): string {
  const decoded = safeDecode(item.slugRaw).normalize("NFC").toLowerCase();
  if (isValidSlug(decoded)) return decoded;
  const ascii = asciiSlug(decoded || item.title);
  return ascii.length >= 3 ? `${ascii}-${item.wpId}` : `${item.type === "page" ? "page" : "post"}-${item.wpId}`;
}

function uniqueSlug(base: string, used: Set<string>): string {
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const s = `${base.slice(0, 80 - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!used.has(s)) return s;
  }
}

function legacyKey(raw: string): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw, "http://legacy.invalid");
  } catch {
    return null;
  }
  let p = u.pathname;
  if (BASE_PATH && (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`))) p = p.slice(BASE_PATH.length) || "/";
  return normalizeLegacyPath(p, u.search);
}

const seoValue = (v: string | undefined) => (v && !v.includes("%%") && !v.includes("#") ? v.trim() : "");

export function prepareImport(db: DB, wxr: WxrData, input: ImportOptions): Prepared {
  const warnings: string[] = [];
  const opts = { ...input };
  if (opts.commentsCommunityId != null && !db.select({ id: schema.communities.id }).from(schema.communities).where(eq(schema.communities.id, opts.commentsCommunityId)).get()) {
    warnings.push("コメントの移し先のコミュニティが見つからないため、コメントは移しません");
    opts.commentsCommunityId = null;
  }
  const notImported = new Map<string, number>();
  const bump = (label: string) => notImported.set(label, (notImported.get(label) ?? 0) + 1);

  const attachments = new Map<number, { url: string; alt: string }>();
  for (const it of wxr.items) {
    if (it.type === "attachment" && it.attachmentUrl) attachments.set(it.wpId, { url: it.attachmentUrl, alt: it.meta._wp_attachment_image_alt ?? "" });
  }

  const targets: WxrItem[] = [];
  for (const it of wxr.items) {
    if (it.type === "attachment") continue;
    if (!IMPORT_TYPES.has(it.type)) {
      bump(`投稿タイプ「${it.type}」`);
      continue;
    }
    if (!STATUS_MAP[it.status]) {
      if (it.status !== "auto-draft" && it.status !== "inherit") bump(`状態「${it.status}」の${it.type === "page" ? "固定ページ" : "投稿"}`);
      continue;
    }
    targets.push(it);
  }

  // スラッグの決定（既存記事と、今回の取り込み内での重複の両方を見る）
  const used = new Set(db.select({ slug: schema.articles.slug }).from(schema.articles).all().map((r) => r.slug));
  const now = new Date();
  const planned = targets.map((item) => {
    const st = STATUS_MAP[item.status]!;
    const type = item.type as "post" | "page";
    const originalSlug = safeDecode(item.slugRaw);
    const base = baseSlug(item);
    let slug = base;
    let action: PlanArticle["action"] = "create";
    if (used.has(base)) {
      if (opts.onSlugConflict === "skip") action = "skip";
      else {
        slug = uniqueSlug(base, used);
        action = "rename";
      }
    }
    if (action !== "skip") used.add(slug);
    const newPath = type === "page" ? `/p/${slug}` : `/articles/${slug}`;
    return { item, type, st, originalSlug, slug, action, newPath, future: !!st.future || (st.status === "published" && !!item.date && item.date > now) };
  });

  // 旧 URL → 新しいパス
  const redirects: Array<{ from: string; to: string }> = [];
  const linkMap = new Map<string, string>();
  const skippedRedirects: string[] = [];
  const addRedirect = (from: string | null, to: string, record = true) => {
    if (!from || from === to) return;
    linkMap.set(from, to);
    if (!record) return;
    if (collidesWithOwnRoute(from)) {
      skippedRedirects.push(from);
      return;
    }
    if (!redirects.some((r) => r.from === from)) redirects.push({ from, to });
  };
  // WordPress を置いていたパス（https://example.com/blog なら /blog）。ID 指定の URL（/blog/?p=123）に使う
  let sitePath = "";
  try {
    sitePath = new URL(wxr.siteUrl).pathname.replace(/\/+$/, "");
  } catch {}
  const oldPathsOf = new Map<number, string[]>();
  for (const p of planned) {
    if (p.action === "skip") continue;
    const published = p.st.status === "published";
    const keys = [legacyKey(p.item.link), legacyKey(`${sitePath}/?p=${p.item.wpId}`), p.type === "page" ? legacyKey(`${sitePath}/?page_id=${p.item.wpId}`) : null].filter((k): k is string => !!k);
    oldPathsOf.set(p.item.wpId, [...new Set(keys)]);
    for (const k of keys) addRedirect(k, p.newPath, published);
  }

  // カテゴリ（最初の1つを記事のカテゴリに、残りはタグへ）
  const existingCats = db.select().from(schema.categories).all();
  const catSlugs = new Set(existingCats.map((c) => c.slug));
  const categories: Prepared["categories"] = new Map();
  const catFor = (term: { slug: string; name: string }) => {
    const key = term.slug || term.name;
    if (categories.has(key)) return key;
    const decoded = safeDecode(term.slug).toLowerCase();
    const hit = existingCats.find((c) => c.slug === decoded || c.name === term.name);
    if (hit) categories.set(key, { name: hit.name, slug: hit.slug, existingId: hit.id });
    else {
      let slug = isValidSlug(decoded) ? decoded : asciiSlug(term.name) || `category-${categories.size + 1}`;
      if (catSlugs.has(slug)) slug = uniqueSlug(slug, catSlugs);
      catSlugs.add(slug);
      categories.set(key, { name: term.name, slug, existingId: null });
    }
    return key;
  };

  const existingTagNames = new Set(db.select({ name: schema.tags.name }).from(schema.tags).all().map((t) => t.name));
  const newTagNames = new Set<string>();

  const articles: Prepared["articles"] = [];
  const authorCount = new Map<string, number>();
  const issueMap = new Map<string, { kind: Issue["kind"]; label: string; articles: string[] }>();
  const allImages = new Set<string>();
  const ctx = { siteUrl: wxr.siteUrl, attachments, linkMap, normalize: normalizeLegacyPath };

  for (const p of planned) {
    const { item } = p;
    const conv = convertContent(item.contentHtml, item.meta, ctx);
    const thumb = attachments.get(Number(item.meta._thumbnail_id));
    const images = [...conv.images];
    if (thumb && /^https?:/.test(thumb.url)) images.unshift(thumb.url);
    let status = p.st.status;
    if (opts.draftIfIssues && conv.issues.length) status = "draft";
    const approved = item.comments.filter((c) => c.approved && (c.type === "" || c.type === "comment"));

    let categoryKey: string | null = null;
    const tagNames: string[] = [];
    if (p.type === "post") {
      const [first, ...rest] = item.categories.filter((c) => c.name && c.slug !== "uncategorized");
      if (first) categoryKey = catFor(first);
      for (const c of rest) tagNames.push(c.name);
      for (const t of item.tags) tagNames.push(t.name);
    }
    const uniqTags = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))].slice(0, 20);

    const plan: PlanArticle = {
      wpId: item.wpId,
      type: p.type,
      title: item.title || "（無題）",
      wpStatus: item.status,
      status,
      future: p.future,
      slug: p.slug,
      originalSlug: p.originalSlug,
      slugChanged: !!p.originalSlug && p.slug !== p.originalSlug,
      action: p.action,
      newPath: p.newPath,
      oldPaths: oldPathsOf.get(item.wpId) ?? [],
      author: item.creator,
      issues: conv.issues,
      images: images.length,
      comments: approved.length,
    };
    if (p.action !== "skip") {
      authorCount.set(item.creator, (authorCount.get(item.creator) ?? 0) + 1);
      for (const i of conv.issues) {
        const key = `${i.kind}:${i.label}`;
        const e = issueMap.get(key) ?? { kind: i.kind, label: i.label, articles: [] };
        e.articles.push(plan.title);
        issueMap.set(key, e);
      }
      for (const u of images) allImages.add(u);
      for (const t of uniqTags) if (!existingTagNames.has(t)) newTagNames.add(t);
    }
    articles.push({
      plan,
      item,
      markdown: conv.markdown,
      excerpt: (htmlToPlain(item.excerptHtml) || excerptFromHtml(item.contentHtml)).slice(0, 300),
      coverUrl: thumb?.url ?? "",
      coverAlt: thumb?.alt ?? "",
      images,
      categoryKey,
      tagNames: uniqTags,
      seoTitle: seoValue(item.meta._yoast_wpseo_title) || seoValue(item.meta._aioseo_title),
      seoDescription: seoValue(item.meta._yoast_wpseo_metadesc) || seoValue(item.meta._aioseo_description),
    });
  }

  // カテゴリ・タグのアーカイブ URL（WordPress の初期設定 /category/〇〇 /tag/〇〇）
  const usedCategoryKeys = new Set(articles.filter((a) => a.plan.action !== "skip").map((a) => a.categoryKey));
  for (const [key, c] of categories) if (usedCategoryKeys.has(key)) addRedirect(legacyKey(`${sitePath}/category/${key}`), `/categories/${c.slug}`);

  // 投稿者
  const users = db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).all();
  const authors = [...authorCount.keys()].map((login) => {
    const a = wxr.authors.find((x) => x.login === login) ?? { login, email: "", displayName: login };
    const byEmail = a.email ? users.find((u) => u.email.toLowerCase() === a.email.toLowerCase()) : undefined;
    const mapped = opts.authorMap[login] ?? (byEmail ? byEmail.id : "create");
    const matched = typeof mapped === "number" ? users.find((u) => u.id === mapped) : undefined;
    return { login, displayName: a.displayName, email: a.email, articles: authorCount.get(login) ?? 0, mappedTo: matched ? matched.id : ("create" as const), matchedUser: matched?.name ?? null };
  });

  if (!wxr.siteUrl) warnings.push("元サイトの URL が読めないため、相対パスの画像と内部リンクは変換できません");
  if (opts.commentsCommunityId == null && articles.some((a) => a.plan.comments > 0)) warnings.push("承認済みコメントがあります。移す場合はコミュニティを選んでください（初期設定では移しません）");
  if (planned.some((p) => p.action === "skip")) warnings.push("同じスラッグの記事が既にあるため取り込まない記事があります（既存記事は上書きしません）");

  const live = articles.filter((a) => a.plan.action !== "skip");
  const report: DryRunReport = {
    site: { title: wxr.siteTitle, url: wxr.siteUrl },
    counts: {
      posts: live.filter((a) => a.plan.type === "post").length,
      pages: live.filter((a) => a.plan.type === "page").length,
      published: live.filter((a) => a.plan.status === "published" && !a.plan.future).length,
      drafts: live.filter((a) => a.plan.status === "draft").length,
      future: live.filter((a) => a.plan.status === "published" && a.plan.future).length,
      attachments: attachments.size,
      comments: live.reduce((n, a) => n + a.plan.comments, 0),
      images: allImages.size,
      redirects: redirects.length,
      newCategories: [...categories.values()].filter((c) => c.existingId == null).length,
      newTags: newTagNames.size,
      conflicts: articles.filter((a) => a.plan.action !== "create").length,
      slugChanged: live.filter((a) => a.plan.slugChanged).length,
      withIssues: live.filter((a) => a.plan.issues.length).length,
    },
    authors,
    articles: articles.map((a) => a.plan),
    issueSummary: [...issueMap.values()],
    notImported: [...notImported].map(([label, count]) => ({ label, count })),
    skippedRedirects,
    warnings,
  };
  return { report, articles, categories, redirects, opts };
}

export function dryRun(db: DB, wxr: WxrData, opts: ImportOptions): DryRunReport {
  return prepareImport(db, wxr, opts).report;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

/** ユーザー名（半角英数字と _ で3〜20文字）。日本語のログイン名はメールアドレスの @ より前を使う */
function handleFrom(login: string, email: string, taken: Set<string>): string {
  const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 16);
  const base = [clean(login), clean(email.split("@")[0] ?? ""), "author"].find((v) => v.length >= 3)!;
  let h = base;
  for (let n = 2; taken.has(h); n++) h = `${base}_${n}`.slice(0, 20);
  taken.add(h);
  return h;
}

/** 本文 HTML から抜粋用のプレーンテキストを作る（ショートコード・スクリプト・ブロックのコメントは除く） */
function excerptFromHtml(html: string, length = 120): string {
  const text = htmlToPlain(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|iframe)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/\[\/?[a-z][a-z0-9_-]*(?:\s[^\]]*)?\]/g, "")
      .replace(/<\/(p|div|h[1-6]|li|td|th|tr|figcaption|blockquote)>/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export type RunDeps = {
  /** 取り込みを実行する管理者（画像の登録者・投稿者不明の記事の紐付け先） */
  importerId: number;
  uploadDir: string;
  /** 画像取得（テスト用に差し替え可能） */
  fetcher?: (url: string) => Promise<FetchedImage>;
  onProgress?: (message: string) => void;
};

export async function runImport(db: DB, wxr: WxrData, input: ImportOptions, deps: RunDeps): Promise<ImportResult> {
  const prep = prepareImport(db, wxr, input);
  const opts = prep.opts;
  const log = deps.onProgress ?? (() => {});
  const live = prep.articles.filter((a) => a.plan.action !== "skip");

  // 1) 画像の取得（トランザクションの外。失敗した画像は元 URL のまま残す）
  const saved = new Map<string, { filename: string; mime: string; size: number }>();
  const failed = new Map<string, string>();
  const written: string[] = [];
  if (opts.downloadImages) {
    const urls = [...new Set(live.flatMap((a) => a.images))];
    await fs.mkdir(deps.uploadDir, { recursive: true });
    let done = 0;
    await pool(urls, 4, async (url) => {
      try {
        const img = await (deps.fetcher ?? fetchImage)(url);
        const filename = newUploadFilename(img.ext, crypto.randomBytes(6).toString("hex"));
        await fs.writeFile(path.join(deps.uploadDir, filename), img.buf);
        written.push(filename);
        saved.set(url, { filename, mime: img.mime, size: img.buf.length });
      } catch (e) {
        failed.set(url, (e as Error).message);
      }
      done++;
      if (done % 10 === 0 || done === urls.length) log(`画像 ${done}/${urls.length}`);
    });
  }

  const rewrite = (md: string) => {
    let out = md;
    for (const [url, f] of saved) out = out.split(`](${url.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29")})`).join(`](/uploads/${f.filename})`);
    return out;
  };

  // 2) DB への書き込み（全体を1つのトランザクションに。失敗したら保存した画像も消す）
  try {
    const result = db.transaction((tx) => {
      const created = { posts: 0, pages: 0, users: 0, categories: 0, tags: 0, redirects: 0, communityPosts: 0, comments: 0 };
      for (const [, f] of saved) tx.insert(schema.mediaFiles).values({ filename: f.filename, mime: f.mime, size: f.size, uploadedBy: deps.importerId }).run();

      // 投稿者
      const authorIds = new Map<string, number>();
      const handles = new Set(tx.select({ h: schema.users.handle }).from(schema.users).all().map((r) => r.h));
      for (const a of prep.report.authors) {
        if (typeof a.mappedTo === "number") {
          authorIds.set(a.login, a.mappedTo);
          continue;
        }
        const handle = handleFrom(a.login, a.email, handles);
        const emailTaken = a.email && tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, a.email.toLowerCase())).get();
        const email = a.email && !emailTaken ? a.email.toLowerCase() : `${handle}@wordpress-import.invalid`;
        const u = tx
          .insert(schema.users)
          .values({ email, handle, name: a.displayName || a.login, role: "editor", passwordHash: hashPassword(crypto.randomBytes(32).toString("base64url")) })
          .returning({ id: schema.users.id })
          .get();
        authorIds.set(a.login, u.id);
        created.users++;
      }

      // カテゴリ
      const catIds = new Map<string, number>();
      for (const [key, c] of prep.categories) {
        if (!live.some((a) => a.categoryKey === key)) continue;
        if (c.existingId != null) catIds.set(key, c.existingId);
        else {
          catIds.set(key, tx.insert(schema.categories).values({ name: c.name, slug: c.slug }).returning({ id: schema.categories.id }).get().id);
          created.categories++;
        }
      }

      // タグ
      const tagRows = new Map(tx.select().from(schema.tags).all().map((t) => [t.name, t]));
      const tagSlugs = new Set([...tagRows.values()].map((t) => t.slug));
      const tagId = (name: string) => {
        const hit = tagRows.get(name);
        if (hit) return hit.id;
        let slug = asciiSlug(name, 60) || `tag-${Buffer.from(name).toString("hex").slice(0, 16)}`;
        if (tagSlugs.has(slug)) slug = uniqueSlug(slug, tagSlugs);
        tagSlugs.add(slug);
        const row = tx.insert(schema.tags).values({ name, slug }).returning().get();
        tagRows.set(name, row);
        created.tags++;
        return row.id;
      };

      const out: ImportResult["articles"] = [];
      for (const a of live) {
        const p = a.plan;
        const authorId = authorIds.get(p.author) ?? deps.importerId;
        const publishedAt = p.status === "published" ? (a.item.date ?? new Date()) : null;
        const cover = a.coverUrl && saved.get(a.coverUrl) ? `/uploads/${saved.get(a.coverUrl)!.filename}` : /^https?:\/\//.test(a.coverUrl) ? a.coverUrl : "";
        const row = tx
          .insert(schema.articles)
          .values({
            type: p.type,
            slug: p.slug,
            title: p.title,
            excerpt: a.excerpt,
            body: rewrite(a.markdown),
            coverUrl: cover,
            coverAlt: cover ? a.coverAlt : "",
            categoryId: a.categoryKey ? (catIds.get(a.categoryKey) ?? null) : null,
            authorId,
            status: p.status,
            featured: p.type === "post" && a.item.sticky,
            seoTitle: a.seoTitle,
            seoDescription: a.seoDescription,
            publishedAt,
            createdAt: a.item.date ?? new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: schema.articles.id })
          .get();
        for (const name of a.tagNames) tx.insert(schema.articleTags).values({ articleId: row.id, tagId: tagId(name) }).onConflictDoNothing().run();
        if (p.type === "page") created.pages++;
        else created.posts++;
        out.push({ title: p.title, path: p.newPath, status: p.status });

        // コメント → コミュニティへ「記事の共有投稿＋コメント」
        const comments = a.item.comments.filter((c) => c.approved && (c.type === "" || c.type === "comment")).sort((x, y) => (x.date?.getTime() ?? 0) - (y.date?.getTime() ?? 0));
        if (opts.commentsCommunityId != null && p.status === "published" && comments.length) {
          const post = tx
            .insert(schema.posts)
            .values({
              authorId,
              communityId: opts.commentsCommunityId,
              articleId: row.id,
              body: `記事「${p.title}」に WordPress で寄せられたコメント（${comments.length}件）を移しました。`,
              createdAt: publishedAt ?? new Date(),
            })
            .returning({ id: schema.posts.id })
            .get();
          created.communityPosts++;
          for (const c of comments) {
            const when = c.date ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(c.date) : "";
            const body = `${c.author || "匿名"}さん${when ? `（${when}）` : ""}\n${htmlToPlain(c.content)}`.slice(0, 5000);
            tx.insert(schema.comments).values({ postId: post.id, authorId, body, createdAt: c.date ?? new Date() }).run();
            created.comments++;
          }
        }
      }

      // 旧 URL の転送（同じ旧 URL があれば転送先を更新）
      for (const r of prep.redirects) {
        tx.insert(schema.redirects)
          .values({ fromPath: r.from, toPath: r.to, source: "wordpress" })
          .onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: r.to, source: "wordpress" } })
          .run();
        created.redirects++;
      }
      return { created, articles: out };
    });

    const failedList = [...failed].map(([url, reason]) => ({ url, reason, articles: live.filter((a) => a.images.includes(url)).map((a) => a.plan.title) }));
    return {
      created: result.created,
      skipped: prep.articles.filter((a) => a.plan.action === "skip").map((a) => ({ title: a.plan.title, reason: `スラッグ「${a.plan.slug}」の記事が既にあります` })),
      images: { downloaded: saved.size, failed: failedList },
      articles: result.articles,
    };
  } catch (e) {
    await Promise.all(written.map((f) => fs.unlink(path.join(deps.uploadDir, f)).catch(() => {})));
    throw e;
  }
}
