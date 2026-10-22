"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin, requireEditor } from "@/lib/auth";
import { saveSettings, type Settings } from "@/lib/settings";
import { isValidSlug, parseJstLocal, slugify } from "@/lib/format";
import { plainExcerpt } from "@/lib/markdown";
import type { FormState } from "./auth";

const { articles, articleTags, tags, categories, communities, communityMembers, users, posts } = schema;
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

  if (!title) return { error: "タイトルを入力してください" };
  if (!slug) slug = slugify(title);
  if (!isValidSlug(slug)) return { error: "URL（スラッグ）は半角英小文字・数字・ハイフンで入力してください" };
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

  // タグ（読点・カンマ区切り）
  db.delete(articleTags).where(eq(articleTags.articleId, articleId)).run();
  const names = [...new Set(tagInput.split(/[,、，]/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
  for (const name of names) {
    let tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (!tag) {
      let tslug = slugify(name);
      if (tslug.startsWith("post-")) tslug = `tag-${Buffer.from(name).toString("hex").slice(0, 16)}`;
      if (db.select().from(tags).where(eq(tags.slug, tslug)).get()) tslug = `${tslug}-${Date.now().toString(36)}`;
      tag = db.insert(tags).values({ name, slug: tslug }).returning().get();
    }
    db.insert(articleTags).values({ articleId, tagId: tag.id }).onConflictDoNothing().run();
  }

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
  };
  if (!next.siteName) return { error: "サイト名を入力してください" };
  if (!/^#[0-9a-fA-F]{6}$/.test(next.accentColor!)) return { error: "テーマカラーは #RRGGBB 形式で入力してください" };
  if (!/^https?:\/\/[^\s]+$/.test(next.siteUrl!)) return { error: "サイトURLは http(s):// から入力してください" };
  if (next.ga4Id && !/^G-[A-Z0-9]{4,20}$/.test(next.ga4Id)) return { error: "GA4 測定IDは G- から始まる形式で入力してください" };
  if (next.externalTagUrl && !/^https:\/\/[^\s"'<>]+$/.test(next.externalTagUrl))
    return { error: "外部タグのURLは https:// から始まるURLにしてください" };
  saveSettings(next);
  refresh();
  return { ok: "保存しました" };
}

export async function previewMarkdown(md: string): Promise<string> {
  await requireEditor();
  const { renderMarkdown } = await import("@/lib/markdown");
  return renderMarkdown(md).html;
}
