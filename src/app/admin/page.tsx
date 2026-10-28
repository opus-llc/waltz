import Link from "next/link";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, requireEditor } from "@/lib/auth";
import { timeAgo, nowMs } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PartnerCard } from "@/components/admin/PartnerCard";
import { articlePath } from "@/lib/paths";

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await requireEditor();
  const denied = (await searchParams).denied;
  const user = await getCurrentUser();
  const weekAgo = new Date(nowMs() - 7 * 86400_000);
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  const stats = [
    { label: "公開中の記事", value: n(db.select({ n: count() }).from(schema.articles).where(and(eq(schema.articles.status, "published"), eq(schema.articles.type, "post"))).get()) },
    { label: "下書き", value: n(db.select({ n: count() }).from(schema.articles).where(eq(schema.articles.status, "draft")).get()) },
    { label: "メンバー", value: n(db.select({ n: count() }).from(schema.users).get()) },
    { label: "今週の投稿", value: n(db.select({ n: count() }).from(schema.posts).where(gte(schema.posts.createdAt, weekAgo)).get()) },
  ];
  const recentComments = db
    .select({ id: schema.comments.id, body: schema.comments.body, createdAt: schema.comments.createdAt, postId: schema.comments.postId, name: schema.users.name, color: schema.users.avatarColor })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .orderBy(desc(schema.comments.createdAt))
    .limit(5)
    .all();
  const recentUsers = db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).limit(5).all();
  const sharedArticles = db
    .select({ title: schema.articles.title, slug: schema.articles.slug, n: count(schema.posts.id) })
    .from(schema.posts)
    .innerJoin(schema.articles, eq(schema.articles.id, schema.posts.articleId))
    .groupBy(schema.articles.id)
    .orderBy(desc(count(schema.posts.id)))
    .limit(5)
    .all();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {denied && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">この操作は管理者だけができます。</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">こんにちは、{user?.name}さん</h1>
        <Link href="/admin/articles/new" className="btn btn-primary">＋ 記事を書く</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-bold text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">新着コメント</h2>
          <ul className="mt-3 divide-y divide-line">
            {recentComments.map((c) => (
              <li key={c.id}>
                <Link href={`/community/posts/${c.postId}`} className="flex gap-3 py-3 hover:bg-soft">
                  <Avatar name={c.name} color={c.color} size="sm" />
                  <span className="min-w-0 text-sm">
                    <span className="font-bold">{c.name}</span> <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
                    <span className="block line-clamp-2 text-muted">{c.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">コミュニティで話題の記事</h2>
          <p className="mt-1 text-xs text-muted">コミュニティに共有された回数</p>
          <ol className="mt-3 space-y-3">
            {sharedArticles.map((a) => (
              <li key={a.slug} className="flex items-baseline gap-3 text-sm">
                <span className="accent-text w-6 shrink-0 text-right font-bold tabular-nums">{a.n}</span>
                <Link href={articlePath(a.slug)} className="hover:underline">{a.title}</Link>
              </li>
            ))}
            {sharedArticles.length === 0 && <li className="text-sm text-muted">まだありません</li>}
          </ol>
          <h2 className="mt-6 font-bold">新しいメンバー</h2>
          <ul className="mt-3 space-y-2">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-2 text-sm">
                <Avatar name={u.name} color={u.avatarColor} size="xs" />
                <Link href={`/community/u/${u.handle}`} className="hover:underline">{u.name}</Link>
                <span className="truncate text-xs text-muted">{u.headline}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PartnerCard kind="content" />
        <PartnerCard kind="diagnose" />
      </div>
    </div>
  );
}
