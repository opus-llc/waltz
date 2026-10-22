import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { feed, postComments } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { PostCard } from "@/components/PostCard";
import { CommentForm } from "@/components/CommentForm";
import { Avatar } from "@/components/Avatar";
import { PostBody } from "@/components/PostBody";

function load(id: number, viewerId?: number, admin = false) {
  return feed({ postId: id, viewerId, includeHidden: admin, limit: 1 })[0] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/community/posts/[id]">): Promise<Metadata> {
  const p = load(Number((await params).id));
  if (!p) return {};
  return { title: `${p.author.name}さんの投稿`, description: p.body.slice(0, 100) };
}

export default async function PostPage({ params }: PageProps<"/community/posts/[id]">) {
  const user = await getCurrentUser();
  const post = load(Number((await params).id), user?.id, isAdmin(user));
  if (!post) notFound();
  const comments = postComments(post.id);
  return (
    <div className="space-y-3">
      <Link href="/community" className="inline-flex min-h-[44px] items-center px-4 text-sm text-muted hover:text-fg sm:px-0">← タイムラインへ</Link>
      <PostCard post={post} viewer={user} linkToDetail={false} />
      <section id="comments" className="border-line bg-white sm:rounded-2xl sm:border">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold">コメント {comments.length}件</h2>
        <ul className="divide-y divide-line">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3 p-4">
              <Link href={`/community/u/${c.handle}`} className="shrink-0"><Avatar name={c.name} color={c.avatarColor} size="sm" /></Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm"><Link href={`/community/u/${c.handle}`} className="font-bold hover:underline">{c.name}</Link> <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span></p>
                {c.headline && <p className="truncate text-xs text-muted">{c.headline}</p>}
                <div className="mt-1.5 text-[15px]"><PostBody text={c.body} /></div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-4">
          {user ? <CommentForm postId={post.id} /> : (
            <p className="text-sm">コメントするには <Link href={`/login?next=/community/posts/${post.id}`} className="accent-text font-bold">ログイン</Link> してください。</p>
          )}
        </div>
      </section>
    </div>
  );
}
