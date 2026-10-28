import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listCommunities, newMembers, featuredArticles } from "@/lib/queries";
import { JoinButton } from "@/components/JoinButton";
import { Avatar } from "@/components/Avatar";
import { ArticleCover } from "@/components/ArticleCover";
import { articlePath } from "@/lib/paths";

export const metadata: Metadata = { title: "探す" };

export default async function Explore({ searchParams }: PageProps<"/community/explore">) {
  const welcome = (await searchParams).welcome;
  const user = await getCurrentUser();
  const comms = listCommunities(user?.id);
  const members = newMembers(8, user?.id);
  const reads = featuredArticles(3);
  return (
    <div className="space-y-8 px-4 sm:px-0">
      {welcome && user && (
        <div className="accent-soft rounded-2xl p-5">
          <p className="font-bold">ようこそ、{user.name}さん 🎉</p>
          <p className="mt-1 text-sm text-muted">まずは気になるコミュニティに参加してみましょう。参加したコミュニティの投稿が「フォロー中」に流れます。</p>
        </div>
      )}
      <section>
        <h1 className="text-lg font-bold">コミュニティ</h1>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {comms.map((c) => (
            <div key={c.id} className="flex flex-col rounded-2xl border border-line bg-white p-4">
              <Link href={`/community/c/${c.slug}`} className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${c.color}1f` }}>{c.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate font-bold hover:underline">{c.name}</span>
                  <span className="block text-xs text-muted">{c.memberCount}人・{c.postCount}件の投稿</span>
                </span>
              </Link>
              <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">{c.description}</p>
              <div className="mt-3 flex justify-end">
                {user ? <JoinButton slug={c.slug} joined={c.joined} /> : <Link href={`/community/c/${c.slug}`} className="btn btn-ghost btn-sm">のぞいてみる</Link>}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold">メンバー</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {members.map((m) => (
            <Link key={m.id} href={`/community/u/${m.handle}`} className="flex flex-col items-center rounded-2xl border border-line bg-white p-4 text-center hover:shadow-sm">
              <Avatar name={m.name} color={m.avatarColor} size="md" />
              <p className="mt-2 w-full truncate text-sm font-bold">{m.name}</p>
              <p className="line-clamp-2 text-[11px] leading-snug text-muted">{m.headline}</p>
            </Link>
          ))}
        </div>
      </section>
      {reads.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">注目の記事</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {reads.map((a) => (
              <Link key={a.id} href={articlePath(a.slug)} className="overflow-hidden rounded-2xl border border-line bg-white hover:shadow-sm">
                <ArticleCover title={a.title} coverUrl={a.coverUrl} size="sm" />
                <p className="line-clamp-2 p-3 text-sm font-bold leading-snug">{a.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
