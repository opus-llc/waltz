import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { markAllRead } from "@/app/actions/community";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "通知", robots: { index: false } };

const TEXT = {
  like: "さんがあなたの投稿にいいねしました",
  comment: "さんがあなたの投稿にコメントしました",
  follow: "さんがあなたをフォローしました",
  join: "さんがコミュニティに参加しました",
};

export default async function Notifications() {
  const user = await requireUser("/community/notifications");
  const items = listNotifications(user.id);
  const hasUnread = items.some((n) => !n.readAt);
  return (
    <div className="overflow-hidden border-line bg-white sm:rounded-2xl sm:border">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h1 className="font-bold">通知</h1>
        {hasUnread && (
          <form action={markAllRead}><button className="btn btn-ghost btn-sm">すべて既読にする</button></form>
        )}
      </div>
      <ul className="divide-y divide-line">
        {items.map((n) => {
          const href = n.postId ? `/community/posts/${n.postId}` : n.type === "join" && n.communitySlug ? `/community/c/${n.communitySlug}?tab=members` : `/community/u/${n.actorHandle}`;
          return (
            <li key={n.id}>
              <Link href={href} className={`flex gap-3 p-4 hover:bg-soft ${n.readAt ? "" : "accent-soft"}`}>
                <Avatar name={n.actorName} color={n.actorColor} size="sm" />
                <div className="min-w-0 text-sm">
                  <p><b>{n.actorName}</b>{TEXT[n.type]}{n.type === "join" && n.communityName ? `（${n.communityName}）` : ""}</p>
                  {n.postBody && <p className="mt-1 line-clamp-1 text-xs text-muted">{n.postBody}</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && <p className="p-8 text-center text-sm text-muted">通知はまだありません。</p>}
    </div>
  );
}
