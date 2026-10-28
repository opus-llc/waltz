import crypto from "node:crypto";
import { and, count, desc, eq, inArray, like, lte, or } from "drizzle-orm";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { keepCjkEmphasis } from "../turndown-cjk";
import type { DB } from "../../db/connect";
import * as schema from "../../db/schema";
import type { Article } from "../../db/schema";
import { renderMarkdown, plainExcerpt } from "../markdown";
import { isValidSlug, slugify } from "../format";
import { BASE_PATH, withBase } from "../base-path";
import { setArticleTags } from "../article-tags";
import { isReservedSlug } from "../paths";
import { parseRelatedLinks, parseRelatedSlugs, type RelatedLink } from "../related";
import { articlePath } from "../paths";

/**
 * WordPress の REST API（wp/v2）と opus connector プラグイン（opus/v1）の口を、waltz の記事で再現する。
 *
 * concerto は WordPress の記事を wp/v2 で読み、opus/v1 で改善を書き戻す。同じ口を waltz に生やすと、
 * concerto 側はメディアの種類を「WordPress」にするだけで、取り込み・評価・改善の反映まで動く。
 * sonata はここに足した「新規作成」で、書いた記事を直接 waltz へ送る。
 *
 * 再現するのは concerto・sonata が使う範囲だけ（記事＝post のみ。固定ページ・カテゴリ・メディアの API は無い）。
 */

const { articles, categories } = schema;

export const WP_DEFAULT_PER_PAGE = 10;
export const WP_MAX_PER_PAGE = 100;
/** 1記事の本文の上限（文字数）。管理画面の保存と同程度に抑え、巨大な送信で DB を膨らませない */
export const MAX_CONTENT_CHARS = 1_000_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** opus connector プラグインと同じ基準: 保存している本文（waltz では Markdown）そのものの sha256 */
export const contentHash = (body: string) => crypto.createHash("sha256").update(body, "utf8").digest("hex");

/* ───────── 読み取り（wp/v2） ───────── */

const publishedPost = () =>
  and(eq(articles.type, "post"), eq(articles.status, "published"), lte(articles.publishedAt, new Date()));

const pad = (n: number) => String(n).padStart(2, "0");
const isoNoZone = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
/** WordPress の date はサイトの現地時刻（タイムゾーン無し）。waltz は日本時間で運用する */
const jst = (d: Date) => isoNoZone(new Date(d.getTime() + 9 * 3600_000));

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * サイト内の相対パス（/uploads/…・/articles/…）を絶対 URL にする。
 * WordPress は本文の画像・リンクを絶対 URL で返すので、取り込む側（concerto の評価）もその前提で読む
 */
function absolutize(html: string, siteUrl: string): string {
  let origin = "";
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return html;
  }
  return html.replace(/\s(src|href)="(\/(?!\/)[^"]*)"/g, (_m, attr: string, p: string) => ` ${attr}="${origin}${p}"`);
}

export function wpStatus(a: Pick<Article, "status" | "publishedAt">): "publish" | "future" | "draft" {
  if (a.status !== "published") return "draft";
  return a.publishedAt && a.publishedAt.getTime() > Date.now() ? "future" : "publish";
}

export const articleUrl = (siteUrl: string, slug: string) => `${siteUrl}${articlePath(slug)}`;

const absoluteUrl = (u: string, siteUrl: string) => {
  if (!u.startsWith("/")) return u;
  try {
    return `${new URL(siteUrl).origin}${withBase(u)}`;
  } catch {
    return u;
  }
};

export function serializePost(a: Article, siteUrl: string, category?: { slug: string; name: string } | null) {
  const published = a.publishedAt ?? a.createdAt;
  return {
    id: a.id,
    date: jst(published),
    date_gmt: isoNoZone(published),
    modified: jst(a.updatedAt),
    modified_gmt: isoNoZone(a.updatedAt),
    slug: a.slug,
    status: wpStatus(a),
    type: "post",
    link: articleUrl(siteUrl, a.slug),
    title: { rendered: escapeHtml(a.title) },
    content: { rendered: absolutize(renderMarkdown(a.body).html, siteUrl), protected: false },
    excerpt: { rendered: a.excerpt ? `<p>${escapeHtml(a.excerpt)}</p>\n` : "", protected: false },
    featured_media: 0,
    // waltz で足した項目（WordPress には無い）。一覧のカードを作る側が、画像やカテゴリ名のために別の API を叩かずに済むように
    waltz: {
      cover_url: a.coverUrl ? absoluteUrl(a.coverUrl, siteUrl) : null,
      category: category ?? null,
      excerpt: a.excerpt,
    },
  };
}

/** `_fields=id,link,title` の絞り込み。`title.rendered` のような入れ子の指定は先頭の名前で残す */
export function pickFields<T extends Record<string, unknown>>(obj: T, fields: string | null): Partial<T> {
  if (!fields) return obj;
  const keep = new Set(fields.split(",").map((f) => f.trim().split(".")[0]).filter(Boolean));
  if (!keep.size) return obj;
  return Object.fromEntries(Object.entries(obj).filter(([k]) => keep.has(k))) as Partial<T>;
}

export type ListQuery = { page: number; perPage: number; search?: string; slug?: string };

/** wp/v2/posts の検索条件を読む。WordPress と同じく、範囲外は 400 */
export function parseListQuery(params: URLSearchParams): ListQuery {
  const page = params.has("page") ? Number(params.get("page")) : 1;
  const perPage = params.has("per_page") ? Number(params.get("per_page")) : WP_DEFAULT_PER_PAGE;
  if (!Number.isInteger(page) || page < 1) throw new ApiError(400, "rest_invalid_param", "page は 1 以上の整数で指定してください");
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > WP_MAX_PER_PAGE)
    throw new ApiError(400, "rest_invalid_param", `per_page は 1〜${WP_MAX_PER_PAGE} で指定してください`);
  // 公開記事以外は読ませない（WordPress も未ログインでは publish しか返さない）
  const status = params.get("status");
  if (status && status.split(",").some((s) => s.trim() !== "publish"))
    throw new ApiError(400, "rest_invalid_param", "status は publish だけを指定できます");
  return {
    page,
    perPage,
    search: params.get("search")?.trim() || undefined,
    slug: params.get("slug")?.trim() || undefined,
  };
}

/** 記事 ID → カテゴリ（一覧の waltz.category 用） */
export function categoriesFor(db: DB, rows: Article[]): Map<number, { slug: string; name: string }> {
  const ids = [...new Set(rows.map((r) => r.categoryId).filter((v): v is number => v !== null))];
  const cats = ids.length ? db.select({ id: categories.id, slug: categories.slug, name: categories.name }).from(categories).where(inArray(categories.id, ids)).all() : [];
  const byId = new Map(cats.map((c) => [c.id, { slug: c.slug, name: c.name }]));
  return new Map(rows.filter((r) => r.categoryId && byId.has(r.categoryId)).map((r) => [r.id, byId.get(r.categoryId!)!]));
}

export function listPublishedPosts(db: DB, q: ListQuery): { rows: Article[]; total: number; totalPages: number } {
  const conds = [publishedPost()];
  if (q.slug) conds.push(eq(articles.slug, q.slug.toLowerCase()));
  if (q.search) {
    const term = `%${q.search.replace(/[%_]/g, "")}%`;
    conds.push(or(like(articles.title, term), like(articles.body, term), like(articles.excerpt, term))!);
  }
  const where = and(...conds);
  const total = db.select({ n: count() }).from(articles).where(where).get()?.n ?? 0;
  const totalPages = Math.ceil(total / q.perPage);
  // WordPress は記事が1件も無いときだけ page=1 を許し、それ以外の範囲外は 400 を返す。concerto はこの 400 で最終ページを知る
  if (q.page > Math.max(totalPages, 1))
    throw new ApiError(400, "rest_post_invalid_page_number", "要求されたページ番号は、ページ数より大きいです");
  const rows = db
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
    .all();
  return { rows, total, totalPages };
}

export function getPublishedPost(db: DB, id: number): Article | null {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return db.select().from(articles).where(and(eq(articles.id, id), publishedPost())).get() ?? null;
}

/* ───────── 書き込み（opus/v1） ───────── */

/** 状態を問わず、記事（固定ページ以外）を1件 */
export function getPostForEdit(db: DB, id: number): Article | null {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return db.select().from(articles).where(and(eq(articles.id, id), eq(articles.type, "post"))).get() ?? null;
}

export function connectorView(a: Article) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    content: a.body,
    content_hash: contentHash(a.body),
    status: wpStatus(a),
    date_gmt: a.publishedAt ? isoNoZone(a.publishedAt).replace("T", " ") : null,
    modified_gmt: isoNoZone(a.updatedAt).replace("T", " "),
    // waltz で足した項目（opus connector プラグインには無い）
    focus_keyword: a.focusKeyword,
    cta_variant: a.ctaKey,
    related_post_slugs: parseRelatedSlugs(a.relatedSlugs),
    related_links: parseRelatedLinks(a.relatedLinks),
  };
}

/**
 * 送られてきた HTML を waltz の本文（Markdown）に戻す。
 * 自サイトの絶対 URL（absolutize で付けたもの）は、basePath を除いたサイト内のパスへ戻す。
 * script・style・フォーム部品は捨てる（表示時にも sanitize-html が落とすが、保存する前に除く）
 */
export function htmlToMarkdown(html: string, siteUrl: string): string {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*", hr: "---" });
  td.use(gfm);
  td.remove(["script", "style", "noscript", "form", "input", "select", "textarea", "button", "object", "embed", "iframe"]);
  keepCjkEmphasis(td);
  let origin = "";
  try {
    origin = new URL(siteUrl).origin;
  } catch {}
  const local = (raw: string) => {
    const v = raw.trim();
    if (!origin || !v.startsWith(origin)) return v;
    let p = v.slice(origin.length) || "/";
    if (!p.startsWith("/")) return v;
    if (BASE_PATH && (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`))) p = p.slice(BASE_PATH.length) || "/";
    return p;
  };
  const mdUrl = (u: string) => u.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
  td.addRule("link", {
    filter: (node) => node.nodeName === "A" && !!(node as HTMLElement).getAttribute("href"),
    replacement: (content, node) => {
      const href = local((node as HTMLElement).getAttribute("href") ?? "");
      if (!/^(https?:|mailto:|\/|#)/.test(href)) return content;
      const text = content.trim() || href;
      return `[${text}](${mdUrl(href)})`;
    },
  });
  td.addRule("image", {
    filter: "img",
    replacement: (_c, node) => {
      const el = node as HTMLElement;
      const src = local(el.getAttribute("src") ?? "");
      if (!/^(https?:|\/)/.test(src)) return "";
      const alt = (el.getAttribute("alt") ?? "").replace(/[\[\]\n]/g, " ").trim();
      return `![${alt}](${mdUrl(src)})`;
    },
  });
  return td
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Fields = {
  title?: string;
  content?: string;
  format: "html" | "markdown";
  excerpt?: string;
  status?: "draft" | "publish" | "future";
  date?: Date;
  slug?: string;
  tags?: string[];
  category?: string;
  coverUrl?: string;
  coverAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  ctaKey?: string;
  relatedSlugs?: string[];
  relatedLinks?: RelatedLink[];
  modified?: Date;
};

const str = (v: unknown, name: string, max: number): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new ApiError(400, "opus_bad_request", `${name} は文字列で指定してください`);
  if (v.length > max) throw new ApiError(400, "opus_bad_request", `${name} が長すぎます（${max}文字まで）`);
  return v;
};

/** 作成・更新で共通の項目を読む。項目名は WordPress の REST API に合わせる */
export function parseFields(body: unknown): Fields {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "opus_bad_request", "JSON のオブジェクトを送ってください");
  const b = body as Record<string, unknown>;
  const format = b.content_format ?? "html";
  if (format !== "html" && format !== "markdown") throw new ApiError(400, "opus_bad_request", "content_format は html か markdown です");
  const status = b.status;
  if (status !== undefined && status !== "draft" && status !== "publish" && status !== "future")
    throw new ApiError(400, "opus_bad_request", "status は draft・publish・future のどれかです");
  let date: Date | undefined;
  if (b.date !== undefined && b.date !== null) {
    // タイムゾーンの無い値は WordPress と同じくサイトの現地時刻（日本時間）として読む
    const raw = String(b.date);
    date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}+09:00`);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, "opus_bad_request", "date の形式が正しくありません");
  }
  let tags: string[] | undefined;
  if (b.tags !== undefined && b.tags !== null) {
    if (!Array.isArray(b.tags) || b.tags.some((t) => typeof t !== "string" || t.length > 50))
      throw new ApiError(400, "opus_bad_request", "tags は50文字までの文字列の配列で指定してください");
    tags = b.tags as string[];
  }
  const coverUrl = str(b.featured_image_url, "featured_image_url", 2000)?.trim();
  if (coverUrl && !/^(https?:\/\/|\/uploads\/)[^\s"'<>]+$/.test(coverUrl))
    throw new ApiError(400, "opus_bad_request", "featured_image_url は http(s):// から始まる URL にしてください");
  const slug = str(b.slug, "slug", 80)?.trim().toLowerCase();
  if (slug && !isValidSlug(slug)) throw new ApiError(400, "opus_bad_request", "slug は半角英小文字・数字・ハイフンで指定してください");
  if (slug && isReservedSlug(slug)) throw new ApiError(400, "opus_bad_request", `slug「${slug}」はサイトのページと重なるため使えません`);
  const ctaKey = str(b.cta_variant, "cta_variant", 30)?.trim().toLowerCase();
  if (ctaKey && !/^[a-z0-9_-]{1,30}$/.test(ctaKey)) throw new ApiError(400, "opus_bad_request", "cta_variant は英小文字・数字・_- で指定してください");
  let relatedSlugs: string[] | undefined;
  if (b.related_post_slugs !== undefined && b.related_post_slugs !== null) {
    if (!Array.isArray(b.related_post_slugs) || b.related_post_slugs.length > 10 || b.related_post_slugs.some((x) => typeof x !== "string" || !isValidSlug(x)))
      throw new ApiError(400, "opus_bad_request", "related_post_slugs はスラッグの配列（10件まで）で指定してください");
    relatedSlugs = parseRelatedSlugs(JSON.stringify(b.related_post_slugs));
  }
  let relatedLinks: RelatedLink[] | undefined;
  if (b.related_links !== undefined && b.related_links !== null) {
    const ok = Array.isArray(b.related_links) && b.related_links.length <= 10 &&
      b.related_links.every((x) => x && typeof x === "object" && typeof x.url === "string" && /^https?:\/\/[^\s"'<>]+$/.test(x.url) && (x.title === undefined || typeof x.title === "string"));
    if (!ok) throw new ApiError(400, "opus_bad_request", "related_links は { url, title } の配列（10件まで・url は http(s)）で指定してください");
    relatedLinks = parseRelatedLinks(JSON.stringify(b.related_links));
  }
  // 移行用: 元のサイトの更新日時を残す（無ければ保存した時刻）
  let modified: Date | undefined;
  if (b.modified !== undefined && b.modified !== null) {
    const raw = String(b.modified);
    modified = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}+09:00`);
    if (Number.isNaN(modified.getTime())) throw new ApiError(400, "opus_bad_request", "modified の形式が正しくありません");
  }
  return {
    title: str(b.title, "title", 200)?.trim(),
    content: str(b.content, "content", MAX_CONTENT_CHARS),
    format,
    excerpt: str(b.excerpt, "excerpt", 1000)?.trim(),
    status,
    date,
    slug,
    tags,
    category: str(b.category, "category", 100)?.trim(),
    coverUrl,
    coverAlt: str(b.featured_image_alt, "featured_image_alt", 300)?.trim(),
    seoTitle: str(b.seo_title, "seo_title", 200)?.trim(),
    seoDescription: str(b.seo_description, "seo_description", 500)?.trim(),
    focusKeyword: str(b.focus_keyword ?? b.target_keyword, "focus_keyword", 200)?.trim(),
    ctaKey,
    relatedSlugs,
    relatedLinks,
    modified,
  };
}

const toBody = (f: Fields, siteUrl: string) =>
  f.content === undefined ? undefined : f.format === "markdown" ? f.content : htmlToMarkdown(f.content, siteUrl);

function findCategoryId(db: DB, key: string | undefined): number | null | undefined {
  if (key === undefined) return undefined;
  if (!key) return null;
  const row = db
    .select({ id: categories.id })
    .from(categories)
    .where(or(eq(categories.slug, key.toLowerCase()), eq(categories.name, key)))
    .get();
  return row?.id ?? null;
}

/** 使われていないスラッグにする（-2, -3 … を付ける）。外部からの作成はスラッグの重複で失敗させない */
function uniqueSlug(db: DB, base: string, exceptId?: number): string {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 76)}-${n}`;
    if (isReservedSlug(candidate)) continue;
    const hit = db.select({ id: articles.id }).from(articles).where(eq(articles.slug, candidate)).get();
    if (!hit || hit.id === exceptId) return candidate;
  }
}

function publishState(f: Fields, current?: Pick<Article, "status" | "publishedAt">) {
  if (f.status === undefined) {
    return { status: current?.status ?? ("draft" as const), publishedAt: f.date ?? current?.publishedAt ?? null };
  }
  if (f.status === "draft") return { status: "draft" as const, publishedAt: f.date ?? current?.publishedAt ?? null };
  if (f.status === "future" && !(f.date && f.date.getTime() > Date.now()))
    throw new ApiError(400, "opus_bad_request", "status=future には未来の date が要ります");
  return { status: "published" as const, publishedAt: f.date ?? current?.publishedAt ?? new Date() };
}

/** sonata などからの新規作成。既定は下書き */
export function createPost(db: DB, body: unknown, opts: { authorId: number | null; siteUrl: string }) {
  const f = parseFields(body);
  if (!f.title) throw new ApiError(400, "opus_bad_request", "title は必須です");
  const md = toBody(f, opts.siteUrl);
  if (!md?.trim()) throw new ApiError(400, "opus_bad_request", "content は必須です");
  const { status, publishedAt } = publishState({ ...f, status: f.status ?? "draft" });
  const now = new Date();
  return db.transaction((tx) => {
    const slug = uniqueSlug(tx, f.slug || slugify(f.title!));
    const row = tx
      .insert(articles)
      .values({
        type: "post",
        title: f.title!,
        slug,
        body: md,
        excerpt: f.excerpt || plainExcerpt(md),
        coverUrl: f.coverUrl ?? "",
        coverAlt: f.coverAlt ?? "",
        categoryId: findCategoryId(tx, f.category) ?? null,
        authorId: opts.authorId,
        status,
        publishedAt,
        seoTitle: f.seoTitle ?? "",
        seoDescription: f.seoDescription ?? "",
        focusKeyword: f.focusKeyword ?? "",
        ctaKey: f.ctaKey ?? "",
        relatedSlugs: JSON.stringify(f.relatedSlugs ?? []),
        relatedLinks: JSON.stringify(f.relatedLinks ?? []),
        createdAt: now,
        updatedAt: f.modified ?? now,
      })
      .returning()
      .get();
    if (f.tags) setArticleTags(tx, row.id, f.tags);
    return row;
  });
}

/**
 * 既存記事の更新。opus connector と同じく expected_hash（今の本文の指紋）が一致するときだけ書く。
 * 読んでから書くまでの間に人が編集していたら 409 で止める（concerto の安全装置）
 */
export function updatePost(db: DB, id: number, body: unknown, opts: { siteUrl: string }) {
  const expected = body && typeof body === "object" ? (body as Record<string, unknown>).expected_hash : undefined;
  if (typeof expected !== "string" || !expected) throw new ApiError(400, "opus_bad_request", "content and expected_hash are required");
  const f = parseFields(body);
  const md = toBody(f, opts.siteUrl);
  if (md !== undefined && !md.trim()) throw new ApiError(400, "opus_bad_request", "content が空です");
  return db.transaction((tx) => {
    const current = getPostForEdit(tx, id);
    if (!current) throw new ApiError(404, "opus_not_found", "post not found");
    const now = contentHash(current.body);
    if (now.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(now), Buffer.from(expected)))
      throw new ApiError(409, "opus_conflict", "content changed on waltz side");
    const { status, publishedAt } = publishState(f, current);
    tx.update(articles)
      .set({
        ...(md !== undefined ? { body: md } : {}),
        ...(f.title ? { title: f.title } : {}),
        ...(f.excerpt !== undefined ? { excerpt: f.excerpt || plainExcerpt(md ?? current.body) } : {}),
        ...(f.slug ? { slug: uniqueSlug(tx, f.slug, current.id) } : {}),
        ...(f.coverUrl !== undefined ? { coverUrl: f.coverUrl } : {}),
        ...(f.coverAlt !== undefined ? { coverAlt: f.coverAlt } : {}),
        ...(f.category !== undefined ? { categoryId: findCategoryId(tx, f.category) ?? null } : {}),
        ...(f.seoTitle !== undefined ? { seoTitle: f.seoTitle } : {}),
        ...(f.seoDescription !== undefined ? { seoDescription: f.seoDescription } : {}),
        ...(f.focusKeyword !== undefined ? { focusKeyword: f.focusKeyword } : {}),
        ...(f.ctaKey !== undefined ? { ctaKey: f.ctaKey } : {}),
        ...(f.relatedSlugs !== undefined ? { relatedSlugs: JSON.stringify(f.relatedSlugs.filter((sl) => sl !== current.slug)) } : {}),
        ...(f.relatedLinks !== undefined ? { relatedLinks: JSON.stringify(f.relatedLinks) } : {}),
        status,
        publishedAt,
        updatedAt: f.modified ?? new Date(),
      })
      .where(eq(articles.id, current.id))
      .run();
    if (f.tags) setArticleTags(tx, current.id, f.tags);
    return getPostForEdit(tx, current.id)!;
  });
}
