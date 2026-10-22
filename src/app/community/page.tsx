import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { feed, joinedCommunities } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { Tabs } from "@/components/Tabs";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "コミュニティ" };

export default async function CommunityHome({ searchParams }: PageProps<"/community">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const tab = sp.tab === "following" && user ? "following" : sp.tab === "questions" ? "questions" : "all";
  const items = feed({
    viewerId: user?.id,
    mode: tab === "following" ? "following" : "all",
    kind: tab === "questions" ? "question" : undefined,
    limit: 40,
  });
  const mine = user ? joinedCommunities(user.id) : [];

  return (
    <div className="space-y-3">
      {sp.denied && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">管理画面は編集者・管理者だけが使えます。</p>}
      <div className="overflow-hidden border-line bg-white sm:rounded-2xl sm:border">
        <Tabs
          active={tab}
          tabs={[
            { key: "all", label: "おすすめ", href: "/community" },
            ...(user ? [{ key: "following", label: "フォロー中", href: "/community?tab=following" }] : []),
            { key: "questions", label: "質問", href: "/community?tab=questions" },
          ]}
        />
        <div className="p-4">
          {user ? (
            <div className="flex gap-3">
              <Avatar name={user.name} color={user.avatarColor} />
              <div className="min-w-0 flex-1"><Composer communities={mine} /></div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">参加すると、投稿・コメント・フォローができます。</p>
              <div className="flex gap-2">
                <Link href="/signup?next=/community" className="btn btn-primary btn-sm">無料で参加する</Link>
                <Link href="/login?next=/community" className="btn btn-ghost btn-sm">ログイン</Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3 px-0">
        {items.map((p) => <PostCard key={p.id} post={p} viewer={user} />)}
        {items.length === 0 && (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
            {tab === "following" ? (
              <>まだ投稿がありません。<Link href="/community/explore" className="accent-text font-bold">コミュニティや人を探して</Link>フォローしてみましょう。</>
            ) : (
              "まだ投稿がありません。"
            )}
          </div>
        )}
      </div>
    </div>
  );
}
