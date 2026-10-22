import "server-only";
import { and, desc, eq, inArray, isNull, like, lte, or, sql, count } from "drizzle-orm";
import { db, schema } from "@/db";

const { articles, categories, tags, articleTags, users, posts, comments, likes, follows, communities, communityMembers, events, notifications } = schema;

/* ───────── メディア ───────── */

const publishedPost = () =>
  and(eq(articles.type, "post"), eq(articles.status, "published"), lte(articles.publishedAt, new Date()));

const articleCols = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverUrl: articles.coverUrl,
  coverAlt: articles.coverAlt,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  featured: articles.featured,
  categoryName: categories.name,
  categorySlug: categories.slug,
  authorName: users.name,
  authorHandle: users.handle,
};

export type ArticleCard = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  publishedAt: Date | null;
  updatedAt: Date;
  featured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  authorHandle: string | null;
};

export function listArticles(opts: {
  limit?: number;
  offset?: number;
  categoryId?: number;
  tagId?: number;
  q?: string;
  excludeId?: number;
} = {}): { items: ArticleCard[]; total: number } {
  const conds = [publishedPost()];
  if (opts.categoryId) conds.push(eq(articles.categoryId, opts.categoryId));
  if (opts.excludeId) conds.push(sql`${articles.id} <> ${opts.excludeId}`);
  if (opts.tagId)
    conds.push(
      inArray(
        articles.id,
        db.select({ id: articleTags.articleId }).from(articleTags).where(eq(articleTags.tagId, opts.tagId)),
      ),
    );
  if (opts.q) {
    const term = `%${opts.q.replace(/[%_]/g, "")}%`;
    conds.push(or(like(articles.title, term), like(articles.body, term), like(articles.excerpt, term)));
  }
  const where = and(...conds);
  const items = db
    .select(articleCols)
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(where)
    .orderBy(desc(articles.publishedAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
    .all();
  const total = db.select({ n: count() }).from(articles).where(where).get()?.n ?? 0;
  return { items, total };
}

export function featuredArticles(limit = 3): ArticleCard[] {
  return db
    .select(articleCols)
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(and(publishedPost(), eq(articles.featured, true)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .all();
}

export function getPublishedArticle(slug: string, type: "post" | "page" = "post") {
  const row = db
    .select({
      article: articles,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: users.name,
      authorHandle: users.handle,
      authorHeadline: users.headline,
      authorColor: users.avatarColor,
    })
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(
      and(
        eq(articles.slug, slug),
        eq(articles.type, type),
        eq(articles.status, "published"),
        lte(articles.publishedAt, new Date()),
      ),
    )
    .get();
  return row ?? null;
}

export function getArticleTags(articleId: number) {
  return db
    .select({ id: tags.id, slug: tags.slug, name: tags.name })
    .from(articleTags)
    .innerJoin(tags, eq(tags.id, articleTags.tagId))
    .where(eq(articleTags.articleId, articleId))
    .all();
}

export function categoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      n: sql<number>`(select count(*) from ${articles} a where a.category_id = ${categories.id} and a.type = 'post' and a.status = 'published' and a.published_at <= unixepoch())`,
    })
    .from(categories)
    .orderBy(categories.sort, categories.id)
    .all();
}

export function popularTags(limit = 20) {
  return db
    .select({ slug: tags.slug, name: tags.name, n: count(articleTags.articleId) })
    .from(tags)
    .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(desc(count(articleTags.articleId)))
    .limit(limit)
    .all();
}

export function allPublished(type: "post" | "page" = "post") {
  return db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      body: articles.body,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      authorName: users.name,
      categoryName: categories.name,
    })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .where(and(eq(articles.type, type), eq(articles.status, "published"), lte(articles.publishedAt, new Date())))
    .orderBy(desc(articles.publishedAt))
    .all();
}

/* ───────── コミュニティ ───────── */

export type FeedItem = {
  id: number;
  kind: "post" | "question";
  body: string;
  createdAt: Date;
  hidden: boolean;
  author: { id: number; name: string; handle: string; headline: string; avatarColor: string };
  community: { slug: string; name: string; icon: string; color: string } | null;
  article: { slug: string; title: string; excerpt: string; coverUrl: string } | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export function feed(opts: {
  viewerId?: number | null;
  mode?: "all" | "following";
  communityId?: number;
  authorId?: number;
  articleId?: number;
  postId?: number;
  kind?: "post" | "question";
  includeHidden?: boolean;
  limit?: number;
}): FeedItem[] {
  const viewer = opts.viewerId ?? 0;
  const conds = [];
  if (!opts.includeHidden) conds.push(eq(posts.hidden, false));
  conds.push(or(isNull(posts.communityId), eq(communities.archived, false)));
  if (opts.communityId) conds.push(eq(posts.communityId, opts.communityId));
  if (opts.authorId) conds.push(eq(posts.authorId, opts.authorId));
  if (opts.articleId) conds.push(eq(posts.articleId, opts.articleId));
  if (opts.postId) conds.push(eq(posts.id, opts.postId));
  if (opts.kind) conds.push(eq(posts.kind, opts.kind));
  if (opts.mode === "following" && viewer) {
    conds.push(
      or(
        eq(posts.authorId, viewer),
        inArray(posts.authorId, db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewer))),
        inArray(
          posts.communityId,
          db.select({ id: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, viewer)),
        ),
      ),
    );
  }

  const rows = db
    .select({
      id: posts.id,
      kind: posts.kind,
      body: posts.body,
      createdAt: posts.createdAt,
      hidden: posts.hidden,
      aId: users.id,
      aName: users.name,
      aHandle: users.handle,
      aHeadline: users.headline,
      aColor: users.avatarColor,
      cSlug: communities.slug,
      cName: communities.name,
      cIcon: communities.icon,
      cColor: communities.color,
      arSlug: articles.slug,
      arTitle: articles.title,
      arExcerpt: articles.excerpt,
      arCover: articles.coverUrl,
      arStatus: articles.status,
      likeCount: sql<number>`(select count(*) from ${likes} l where l.post_id = ${posts.id})`,
      commentCount: sql<number>`(select count(*) from ${comments} c where c.post_id = ${posts.id})`,
      likedByMe: sql<number>`exists(select 1 from ${likes} l where l.post_id = ${posts.id} and l.user_id = ${viewer})`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(communities, eq(communities.id, posts.communityId))
    .leftJoin(articles, eq(articles.id, posts.articleId))
    .where(and(...conds))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(opts.limit ?? 30)
    .all();

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    createdAt: r.createdAt,
    hidden: r.hidden,
    author: { id: r.aId, name: r.aName, handle: r.aHandle, headline: r.aHeadline, avatarColor: r.aColor },
    community: r.cSlug ? { slug: r.cSlug, name: r.cName!, icon: r.cIcon!, color: r.cColor! } : null,
    article:
      r.arSlug && r.arStatus === "published"
        ? { slug: r.arSlug, title: r.arTitle!, excerpt: r.arExcerpt!, coverUrl: r.arCover! }
        : null,
    likeCount: Number(r.likeCount),
    commentCount: Number(r.commentCount),
    likedByMe: Boolean(r.likedByMe),
  }));
}

export function postComments(postId: number) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: users.id,
      name: users.name,
      handle: users.handle,
      headline: users.headline,
      avatarColor: users.avatarColor,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt, comments.id)
    .all();
}

export function listCommunities(viewerId?: number | null) {
  const viewer = viewerId ?? 0;
  return db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      icon: communities.icon,
      color: communities.color,
      memberCount: sql<number>`(select count(*) from ${communityMembers} m where m.community_id = ${communities.id})`,
      postCount: sql<number>`(select count(*) from ${posts} p where p.community_id = ${communities.id} and p.hidden = 0)`,
      joined: sql<number>`exists(select 1 from ${communityMembers} m where m.community_id = ${communities.id} and m.user_id = ${viewer})`,
    })
    .from(communities)
    .where(eq(communities.archived, false))
    .orderBy(desc(sql`(select count(*) from ${communityMembers} m where m.community_id = ${communities.id})`))
    .all()
    .map((c) => ({ ...c, memberCount: Number(c.memberCount), postCount: Number(c.postCount), joined: Boolean(c.joined) }));
}

export function getCommunity(slug: string) {
  return db.select().from(communities).where(and(eq(communities.slug, slug), eq(communities.archived, false))).get() ?? null;
}

export function communityMembersList(communityId: number, limit = 60) {
  return db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      headline: users.headline,
      avatarColor: users.avatarColor,
      role: communityMembers.role,
    })
    .from(communityMembers)
    .innerJoin(users, eq(users.id, communityMembers.userId))
    .where(eq(communityMembers.communityId, communityId))
    .orderBy(communityMembers.joinedAt)
    .limit(limit)
    .all();
}

export function isMember(communityId: number, userId?: number | null) {
  if (!userId) return false;
  return !!db
    .select({ x: communityMembers.userId })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .get();
}

export function joinedCommunities(userId: number) {
  return db
    .select({ id: communities.id, slug: communities.slug, name: communities.name, icon: communities.icon, color: communities.color })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .where(and(eq(communityMembers.userId, userId), eq(communities.archived, false)))
    .orderBy(communities.name)
    .all();
}

export function communityEvents(communityId?: number, opts: { upcomingOnly?: boolean; limit?: number } = {}) {
  const conds = [eq(communities.archived, false)];
  if (communityId) conds.push(eq(events.communityId, communityId));
  if (opts.upcomingOnly) conds.push(sql`${events.startsAt} >= unixepoch()`);
  return db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      location: events.location,
      applyUrl: events.applyUrl,
      communitySlug: communities.slug,
      communityName: communities.name,
      communityIcon: communities.icon,
    })
    .from(events)
    .innerJoin(communities, eq(communities.id, events.communityId))
    .where(and(...conds))
    .orderBy(events.startsAt)
    .limit(opts.limit ?? 50)
    .all();
}

export function getUserByHandle(handle: string) {
  const u = db.select().from(users).where(eq(users.handle, handle)).get();
  if (!u) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, email, ...pub } = u;
  return pub;
}

export function followStats(userId: number, viewerId?: number | null) {
  const followers = db.select({ n: count() }).from(follows).where(eq(follows.followeeId, userId)).get()?.n ?? 0;
  const following = db.select({ n: count() }).from(follows).where(eq(follows.followerId, userId)).get()?.n ?? 0;
  const iFollow = viewerId
    ? !!db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId))).get()
    : false;
  return { followers, following, iFollow };
}

export function newMembers(limit = 5, excludeId?: number | null) {
  return db
    .select({ id: users.id, name: users.name, handle: users.handle, headline: users.headline, avatarColor: users.avatarColor })
    .from(users)
    .where(excludeId ? sql`${users.id} <> ${excludeId}` : undefined)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit)
    .all();
}

export function unreadCount(userId: number) {
  return (
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .get()?.n ?? 0
  );
}

export function listNotifications(userId: number, limit = 50) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      postId: notifications.postId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorName: users.name,
      actorHandle: users.handle,
      actorColor: users.avatarColor,
      communityName: communities.name,
      communitySlug: communities.slug,
      postBody: posts.body,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(communities, eq(communities.id, notifications.communityId))
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .all();
}

export function notify(n: {
  userId: number;
  actorId: number;
  type: "like" | "comment" | "follow" | "join";
  postId?: number | null;
  communityId?: number | null;
}) {
  if (n.userId === n.actorId) return;
  db.insert(notifications).values(n).run();
}
