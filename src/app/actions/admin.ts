"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin, requireEditor } from "@/lib/auth";
import { DEFAULT_SETTINGS, saveSettings, type Settings } from "@/lib/settings";
import { isDemo } from "@/lib/demo";
import { isValidSlug, parseJstLocal, slugify } from "@/lib/format";
import { plainExcerpt } from "@/lib/markdown";
import { setArticleTags, splitTagInput } from "@/lib/article-tags";
import { CtaError, validateCtaJson } from "@/lib/cta";
import { isReservedSlug } from "@/lib/paths";
import { parseRelatedLinks, parseRelatedSlugs } from "@/lib/related";
import type { FormState } from "./auth";

const { articles, categories, communities, communityMembers, users, posts } = schema;
const refresh = () => revalidatePath("/", "layout");

export async function saveArticle(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireEditor();
  const id = Number(form.get("id")) || null;
  const type = form.get("type") === "page" ? "page" : "post";
  const title = String(form.get("title") ?? "").trim();
  let slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const body = String(form.get("body") ?? "");
  const excerptInput = String(form.get("excerpt") ?? "").trim();
  const coverUrl = String(form.get("coverUrl") ?? "").trim();
  const coverAlt = String(form.get("coverAlt") ?? "").trim();
  const categoryId = Number(form.get("categoryId")) || null;
  const featured = form.get("featured") === "on";
  const seoTitle = String(form.get("seoTitle") ?? "").trim();
  const seoDescription = String(form.get("seoDescription") ?? "").trim();
  const intent = String(form.get("intent") ?? "save");
  const publishedAtInput = String(form.get("publishedAt") ?? "");
  const tagInput = String(form.get("tags") ?? "");
  const ctaKey = String(form.get("ctaKey") ?? "").trim().toLowerCase();
  const relatedSlugs = parseRelatedSlugs(JSON.stringify(String(form.get("relatedSlugs") ?? "").split(/\s+/).map((v) => v.trim().toLowerCase()).filter(Boolean)));
  const relatedLinks = parseRelatedLinks(
    JSON.stringify(
      String(form.get("relatedLinks") ?? "")
        .split("\n")
        .map((line) => line.trim().match(/^(\S+)\s*(.*)$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => ({ url: m[1], title: m[2] })),
    ),
  );

  if (!title) return { error: "タイトルを入力してください" };
  if (!slug) slug = slugify(title);
  if (!isValidSlug(slug)) return { error: "URL（スラッグ）は半角英小文字・数字・ハイフンで入力してください" };
  if (type === "post" && isReservedSlug(slug)) return { error: `「${slug}」はサイトのページと重なるため、記事のURLに使えません` };
  if (ctaKey && !/^[a-z0-9_-]{1,30}$/.test(ctaKey)) return { error: "CTA の種類は英小文字・数字・_- で入力してください" };
  if (coverUrl && !/^(https?:\/\/|\/uploads\/)[^\s"'<>]+$/.test(coverUrl)) return { error: "アイキャッチ画像のURLが正しくありません" };
  const dup = db
    .select({ id: articles.id })
    .from(articles)
    .where(id ? and(eq(articles.slug, slug), ne(articles.id, id)) : eq(articles.slug, slug))
    .get();
  if (dup) return { error: "このURL（スラッグ）は別の記事で使われています" };

  const existing = id ? db.select().from(articles).where(eq(articles.id, id)).get() : null;
  if (id && !existing) return { error: "記事が見つかりません" };

  let status = existing?.status ?? "draft";
  if (intent === "publish") status = "published";
  if (intent === "unpublish") status = "draft";
  let publishedAt = parseJstLocal(publishedAtInput) ?? existing?.publishedAt ?? null;
  if (status === "published" && !publishedAt) publishedAt = new Date();

  const values = {
    type: type as "post" | "page",
    title,
    slug,
    body,
    excerpt: excerptInput || plainExcerpt(body),
    coverUrl,
    coverAlt,
    categoryId: type === "post" ? categoryId : null,
    featured: type === "post" ? featured : false,
    seoTitle,
    seoDescription,
    ctaKey: type === "post" ? ctaKey : "",
    relatedSlugs: JSON.stringify(type === "post" ? relatedSlugs.filter((sl) => sl !== slug) : []),
    relatedLinks: JSON.stringify(type === "post" ? relatedLinks : []),
    status: status as "draft" | "published",
    publishedAt,
    updatedAt: new Date(),
  };

  let articleId: number;
  if (existing) {
    db.update(articles).set(values).where(eq(articles.id, existing.id)).run();
    articleId = existing.id;
  } else {
    articleId = db.insert(articles).values({ ...values, authorId: user.id }).returning({ id: articles.id }).get().id;
  }

  setArticleTags(db, articleId, splitTagInput(tagInput));

  refresh();
  if (!existing) redirect(`/admin/articles/${articleId}?saved=1`);
  return { ok: intent === "publish" ? "公開しました" : intent === "unpublish" ? "非公開に戻しました" : "保存しました" };
}

export async function deleteArticle(form: FormData) {
  await requireEditor();
  const id = Number(form.get("id"));
  db.delete(articles).where(eq(articles.id, id)).run();
  refresh();
  redirect("/admin/articles");
}

export async function saveCategory(_: FormState, form: FormData): Promise<FormState> {
  await requireEditor();
  const id = Number(form.get("id")) || null;
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase() || slugify(name);
  const description = String(form.get("description") ?? "").trim();
  if (!name) return { error: "名前を入力してください" };
  if (!isValidSlug(slug)) return { error: "スラッグは半角英小文字・数字・ハイフンで入力してください" };
  const dup = db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).get();
  if (dup && dup.id !== id) return { error: "このスラッグは使われています" };
  if (id) db.update(categories).set({ name, slug, description }).where(eq(categories.id, id)).run();
  else db.insert(categories).values({ name, slug, description }).run();
  refresh();
  return { ok: "保存しました" };
}

export async function deleteCategory(form: FormData) {
  await requireEditor();
  db.delete(categories).where(eq(categories.id, Number(form.get("id")))).run();
  refresh();
}

export async function saveCommunity(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = Number(form.get("id")) || null;
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const description = String(form.get("description") ?? "").trim();
  const icon = Array.from(String(form.get("icon") ?? "💬").trim()).slice(0, 2).join("") || "💬";
  const color = String(form.get("color") ?? "");
  if (!name) return { error: "名前を入力してください" };
  if (!isValidSlug(slug)) return { error: "URL（スラッグ）は半角英小文字・数字・ハイフンで入力してください" };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "色を選んでください" };
  const dup = db.select({ id: communities.id }).from(communities).where(eq(communities.slug, slug)).get();
  if (dup && dup.id !== id) return { error: "このURLは使われています" };
  if (id) {
    db.update(communities).set({ name, slug, description, icon, color }).where(eq(communities.id, id)).run();
  } else {
    const c = db.insert(communities).values({ name, slug, description, icon, color, createdBy: user.id }).returning().get();
    db.insert(communityMembers).values({ communityId: c.id, userId: user.id, role: "owner" }).run();
  }
  refresh();
  return { ok: "保存しました" };
}

export async function setCommunityArchived(form: FormData) {
  await requireAdmin();
  db.update(communities)
    .set({ archived: form.get("archived") === "1" })
    .where(eq(communities.id, Number(form.get("id"))))
    .run();
  refresh();
}

export async function setRole(form: FormData) {
  const me = await requireAdmin();
  const userId = Number(form.get("userId"));
  const role = String(form.get("role"));
  if (!["admin", "editor", "member"].includes(role)) return;
  if (userId === me.id) return; // 自分の権限は落とせない（管理者不在を防ぐ）
  db.update(users).set({ role: role as "admin" | "editor" | "member" }).where(eq(users.id, userId)).run();
  refresh();
}

export async function setPostHidden(form: FormData) {
  await requireAdmin();
  db.update(posts)
    .set({ hidden: form.get("hidden") === "1" })
    .where(eq(posts.id, Number(form.get("postId"))))
    .run();
  refresh();
}

export async function updateSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const v = (k: keyof Settings) => String(form.get(k) ?? "").trim();
  const next: Partial<Settings> = {
    siteName: v("siteName"),
    tagline: v("tagline"),
    description: v("description"),
    accentColor: v("accentColor"),
    siteUrl: v("siteUrl").replace(/\/$/, ""),
    ga4Id: v("ga4Id"),
    externalTagUrl: v("externalTagUrl"),
    showPartnerLinks: form.get("showPartnerLinks") === "on" ? "1" : "0",
    footerNote: v("footerNote"),
    gtmId: v("gtmId").toUpperCase(),
    communityEnabled: form.get("communityEnabled") === "on" ? "1" : "0",
    headerCtaLabel: v("headerCtaLabel").slice(0, 30),
    headerCtaUrl: v("headerCtaUrl"),
    posthogKey: v("posthogKey"),
    posthogHost: v("posthogHost").replace(/\/+$/, "") || DEFAULT_SETTINGS.posthogHost,
  };
  try {
    next.ctaBlocks = JSON.stringify(validateCtaJson(String(form.get("ctaBlocks") ?? "")));
  } catch (e) {
    if (e instanceof CtaError) return { error: e.message };
    throw e;
  }
  if (!next.siteName) return { error: "サイト名を入力してください" };
  if (!/^#[0-9a-fA-F]{6}$/.test(next.accentColor!)) return { error: "テーマカラーは #RRGGBB 形式で入力してください" };
  if (!/^https?:\/\/[^\s]+$/.test(next.siteUrl!)) return { error: "サイトURLは http(s):// から入力してください" };
  if (next.ga4Id && !/^G-[A-Z0-9]{4,20}$/.test(next.ga4Id)) return { error: "GA4 測定IDは G- から始まる形式で入力してください" };
  if (next.posthogKey && !/^phc_[A-Za-z0-9]{20,80}$/.test(next.posthogKey)) return { error: "PostHog のプロジェクトキーは phc_ から始まる値です" };
  if (!/^(https:\/\/[^\s"'<>/]+|\/[a-z0-9_-]+)$/i.test(next.posthogHost!)) return { error: "PostHog の送信先は https://ドメイン か /ingest のようなパスにしてください" };
  if (next.gtmId && !/^GTM-[A-Z0-9]{4,12}$/.test(next.gtmId)) return { error: "タグマネージャーのコンテナIDは GTM- から始まる形式で入力してください" };
  if (next.headerCtaUrl && !/^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/.test(next.headerCtaUrl)) return { error: "ヘッダーのボタンのリンク先は https:// か / から入力してください" };
  if (next.externalTagUrl && !/^https:\/\/[^\s"'<>]+$/.test(next.externalTagUrl))
    return { error: "外部タグのURLは https:// から始まるURLにしてください" };
  if (isDemo()) {
    // デモ環境では計測タグとURLを変えさせない（誰でも管理者でログインできるため）
    delete next.ga4Id;
    delete next.gtmId;
    delete next.posthogKey;
    delete next.externalTagUrl;
    delete next.siteUrl;
  }
  saveSettings(next);
  refresh();
  return { ok: "保存しました" };
}

export async function previewMarkdown(md: string): Promise<string> {
  await requireEditor();
  const { renderMarkdown } = await import("@/lib/markdown");
  return renderMarkdown(md).html;
}
