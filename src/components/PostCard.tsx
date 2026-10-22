import Link from "next/link";
import type { FeedItem } from "@/lib/queries";
import type { SafeUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { deletePost } from "@/app/actions/community";
import { Avatar } from "./Avatar";
import { ArticleCover } from "./ArticleCover";
import { LikeButton } from "./LikeButton";
import { PostBody } from "./PostBody";

export function PostCard({ post, viewer, linkToDetail = true }: { post: FeedItem; viewer: SafeUser | null; linkToDetail?: boolean }) {
  const canDelete = viewer && (viewer.id === post.author.id || viewer.role === "admin");
  return (
    <article className="rounded-2xl border border-line bg-white">
      {post.community && (
        <Link href={`/community/c/${post.community.slug}`} className="flex items-center gap-1.5 border-b border-line px-4 py-2 text-xs font-bold text-muted hover:text-fg">
          <span>{post.community.icon}</span>
          {post.community.name}
        </Link>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/community/u/${post.author.handle}`} className="shrink-0">
            <Avatar name={post.author.name} color={post.author.avatarColor} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <Link href={`/community/u/${post.author.handle}`} className="truncate font-bold hover:underline">{post.author.name}</Link>
              <Link href={`/community/posts/${post.id}`} className="shrink-0 text-xs text-muted hover:underline">
                <time dateTime={post.createdAt.toISOString()}>{timeAgo(post.createdAt)}</time>
              </Link>
            </div>
            {post.author.headline && <p className="truncate text-xs text-muted">{post.author.headline}</p>}
          </div>
          {post.kind === "question" && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">質問</span>
          )}
        </div>

        <div className="mt-3 text-[15px]">
          <PostBody text={post.body} />
        </div>

        {post.article && (
          <Link href={`/articles/${post.article.slug}`} className="mt-3 flex overflow-hidden rounded-xl border border-line hover:bg-soft">
            <div className="w-28 shrink-0 sm:w-36">
              <ArticleCover title={post.article.title} coverUrl={post.article.coverUrl} size="sm" className="h-full" />
            </div>
            <div className="min-w-0 p-3">
              <p className="text-[11px] font-bold text-muted">記事</p>
              <p className="line-clamp-2 text-sm font-bold leading-snug">{post.article.title}</p>
              <p className="mt-1 hidden line-clamp-1 text-xs text-muted sm:block">{post.article.excerpt}</p>
            </div>
          </Link>
        )}
        {post.hidden && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">この投稿は管理者により非表示になっています</p>}

        <div className="-mb-2 -ml-3 mt-2 flex items-center">
          <LikeButton postId={post.id} liked={post.likedByMe} count={post.likeCount} loggedIn={!!viewer} />
          <Link href={`/community/posts/${post.id}#comments`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-soft">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 5.5h16v10H9l-5 4v-14Z" strokeLinejoin="round" />
            </svg>
            {post.commentCount}
            <span className="sr-only">件のコメント</span>
          </Link>
          {canDelete && (
            <form action={deletePost} className="ml-auto">
              <input type="hidden" name="postId" value={post.id} />
              {!linkToDetail && <input type="hidden" name="redirectTo" value="home" />}
              <button className="min-h-[44px] rounded-full px-3 text-xs text-muted hover:bg-soft hover:text-red-600">削除</button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}
