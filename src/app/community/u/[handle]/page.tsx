import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserByHandle, followStats, feed, joinedCommunities } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { PostCard } from "@/components/PostCard";

export async function generateMetadata({ params }: PageProps<"/community/u/[handle]">): Promise<Metadata> {
  const u = getUserByHandle((await params).handle);
  return u ? { title: `${u.name}（@${u.handle}）`, description: u.headline } : {};
}

export default async function Profile({ params }: PageProps<"/community/u/[handle]">) {
  const u = getUserByHandle((await params).handle);
  if (!u) notFound();
  const viewer = await getCurrentUser();
  const stats = followStats(u.id, viewer?.id);
  const posts = feed({ authorId: u.id, viewerId: viewer?.id, limit: 30 });
  const comms = joinedCommunities(u.id);
  const isMe = viewer?.id === u.id;
  return (
    <div className="space-y-3">
      <div className="overflow-hidden border-line bg-white sm:rounded-2xl sm:border">
        <div className="h-24" style={{ background: `linear-gradient(120deg, ${u.avatarColor}, ${u.avatarColor}40)` }} />
        <div className="px-4 pb-5">
          <div className="-mt-10 flex items-end justify-between">
            <span className="rounded-full ring-4 ring-white"><Avatar name={u.name} color={u.avatarColor} size="lg" /></span>
            {isMe ? (
              <Link href="/community/settings" className="btn btn-ghost btn-sm">プロフィールを編集</Link>
            ) : viewer ? (
              <FollowButton userId={u.id} following={stats.iFollow} />
            ) : (
              <Link href={`/login?next=/community/u/${u.handle}`} className="btn btn-primary btn-sm">フォローする</Link>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold">{u.name}</h1>
          <p className="text-sm text-muted">@{u.handle}</p>
          {u.headline && <p className="mt-2 font-bold">{u.headline}</p>}
          {u.bio && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{u.bio}</p>}
          {u.website && <a href={u.website} target="_blank" rel="noopener noreferrer nofollow" className="accent-text mt-2 block break-all text-sm underline">{u.website}</a>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span><b>{stats.following}</b> <span className="text-muted">フォロー</span></span>
            <span><b>{stats.followers}</b> <span className="text-muted">フォロワー</span></span>
            <span className="text-muted">{formatDate(u.createdAt)}から参加</span>
          </div>
          {comms.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {comms.map((c) => (
                <Link key={c.id} href={`/community/c/${c.slug}`} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-soft">{c.icon} {c.name}</Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <h2 className="px-4 pt-2 text-sm font-bold text-muted sm:px-1">投稿</h2>
      {posts.map((p) => <PostCard key={p.id} post={p} viewer={viewer} />)}
      {posts.length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">まだ投稿がありません。</p>}
    </div>
  );
}
