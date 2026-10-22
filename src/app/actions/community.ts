"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, isAdmin } from "@/lib/auth";
import { isMember, notify } from "@/lib/queries";
import { parseJstLocal } from "@/lib/format";
import type { FormState } from "./auth";

const { posts, comments, likes, follows, communityMembers, communities, users, notifications, events, articles } = schema;

const refresh = () => revalidatePath("/", "layout");

export async function createPost(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  const kind = form.get("kind") === "question" ? "question" : "post";
  const communityId = Number(form.get("communityId")) || null;
  const articleId = Number(form.get("articleId")) || null;
  if (!body) return { error: "本文を入力してください" };
  if (body.length > 2000) return { error: "本文は2000文字以内にしてください" };
  if (communityId && !isMember(communityId, user.id)) return { error: "参加しているコミュニティにだけ投稿できます" };
  if (articleId) {
    const a = db.select({ status: articles.status }).from(articles).where(eq(articles.id, articleId)).get();
    if (!a || a.status !== "published") return { error: "共有できない記事です" };
  }
  db.insert(posts).values({ authorId: user.id, body, kind, communityId, articleId }).run();
  refresh();
  return { ok: "投稿しました" };
}

export async function deletePost(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("postId"));
  const post = db.select().from(posts).where(eq(posts.id, id)).get();
  if (!post) return;
  if (post.authorId !== user.id && !isAdmin(user)) return;
  db.delete(posts).where(eq(posts.id, id)).run();
  refresh();
  if (form.get("redirectTo") === "home") redirect("/community");
}

export async function toggleLike(postId: number) {
  const user = await requireUser();
  const post = db.select({ authorId: posts.authorId, hidden: posts.hidden }).from(posts).where(eq(posts.id, postId)).get();
  if (!post || post.hidden) return;
  const where = and(eq(likes.postId, postId), eq(likes.userId, user.id));
  if (db.select().from(likes).where(where).get()) {
    db.delete(likes).where(where).run();
  } else {
    db.insert(likes).values({ postId, userId: user.id }).run();
    notify({ userId: post.authorId, actorId: user.id, type: "like", postId });
  }
  refresh();
}

export async function addComment(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const postId = Number(form.get("postId"));
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "コメントを入力してください" };
  if (body.length > 1000) return { error: "コメントは1000文字以内にしてください" };
  const post = db.select({ authorId: posts.authorId, hidden: posts.hidden }).from(posts).where(eq(posts.id, postId)).get();
  if (!post || post.hidden) return { error: "この投稿にはコメントできません" };
  db.insert(comments).values({ postId, authorId: user.id, body }).run();
  notify({ userId: post.authorId, actorId: user.id, type: "comment", postId });
  refresh();
  return { ok: "コメントしました" };
}

export async function toggleFollow(form: FormData) {
  const user = await requireUser();
  const targetId = Number(form.get("userId"));
  if (!targetId || targetId === user.id) return;
  if (!db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).get()) return;
  const where = and(eq(follows.followerId, user.id), eq(follows.followeeId, targetId));
  if (db.select().from(follows).where(where).get()) {
    db.delete(follows).where(where).run();
  } else {
    db.insert(follows).values({ followerId: user.id, followeeId: targetId }).run();
    notify({ userId: targetId, actorId: user.id, type: "follow" });
  }
  refresh();
}

export async function toggleJoin(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const user = await requireUser(`/community/c/${slug}`);
  const c = db.select().from(communities).where(and(eq(communities.slug, slug), eq(communities.archived, false))).get();
  if (!c) return;
  const where = and(eq(communityMembers.communityId, c.id), eq(communityMembers.userId, user.id));
  const m = db.select().from(communityMembers).where(where).get();
  if (m) {
    if (m.role !== "owner") db.delete(communityMembers).where(where).run();
  } else {
    db.insert(communityMembers).values({ communityId: c.id, userId: user.id }).run();
    const owner = db
      .select({ userId: communityMembers.userId })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, c.id), eq(communityMembers.role, "owner")))
      .get();
    if (owner) notify({ userId: owner.userId, actorId: user.id, type: "join", communityId: c.id });
  }
  refresh();
}

export async function markAllRead() {
  const user = await requireUser();
  db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
    .run();
  refresh();
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/community/settings");
  const name = String(form.get("name") ?? "").trim();
  const headline = String(form.get("headline") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const website = String(form.get("website") ?? "").trim();
  const avatarColor = String(form.get("avatarColor") ?? "");
  if (!name || name.length > 40) return { error: "表示名を40文字以内で入力してください" };
  if (headline.length > 60) return { error: "肩書きは60文字以内にしてください" };
  if (bio.length > 400) return { error: "自己紹介は400文字以内にしてください" };
  if (website && !/^https?:\/\/[^\s]+$/.test(website)) return { error: "URLは http:// か https:// で始めてください" };
  db.update(users)
    .set({ name, headline, bio, website, ...(/^#[0-9a-fA-F]{6}$/.test(avatarColor) ? { avatarColor } : {}) })
    .where(eq(users.id, user.id))
    .run();
  refresh();
  return { ok: "保存しました" };
}

export async function createEvent(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const communityId = Number(form.get("communityId"));
  const m = db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, user.id)))
    .get();
  if (!isAdmin(user) && m?.role !== "owner" && m?.role !== "moderator")
    return { error: "イベントを作れるのはコミュニティのオーナーと管理者です" };
  const title = String(form.get("title") ?? "").trim();
  const startsAt = parseJstLocal(String(form.get("startsAt") ?? ""));
  const location = String(form.get("location") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const applyUrl = String(form.get("applyUrl") ?? "").trim();
  if (!title) return { error: "タイトルを入力してください" };
  if (!startsAt) return { error: "日時を入力してください" };
  if (applyUrl && !/^https?:\/\/[^\s]+$/.test(applyUrl)) return { error: "申込URLは http:// か https:// で始めてください" };
  db.insert(events).values({ communityId, title, startsAt, location, description, applyUrl, createdBy: user.id }).run();
  refresh();
  return { ok: "イベントを公開しました" };
}
