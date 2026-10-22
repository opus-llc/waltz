import Link from "next/link";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { joinedCommunities, unreadCount, communityEvents, newMembers, featuredArticles } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { SideNav, BottomTabs } from "@/components/CommunityNav";
import { Avatar } from "@/components/Avatar";
import { logout } from "@/app/actions/auth";

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings();
  const user = await getCurrentUser();
  const unread = user ? unreadCount(user.id) : 0;
  const mine = user ? joinedCommunities(user.id) : [];
  const upcoming = communityEvents(undefined, { upcomingOnly: true, limit: 3 });
  const members = newMembers(4, user?.id);
  const reads = featuredArticles(2);

  return (
    <div className="min-h-dvh bg-[#f4f5f7]">
      {/* スマホ上部バー */}
      <header className="sticky z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <Link href="/" className="flex min-w-0 items-center gap-2 font-serif font-bold">
          <span className="accent-bg inline-block h-5 w-5 shrink-0 rounded" aria-hidden />
          <span className="truncate">{s.siteName}</span>
        </Link>
        <span className="accent-text shrink-0 text-xs font-bold">コミュニティ</span>
        <div className="ml-auto">
          {user ? (
            <Link href={`/community/u/${user.handle}`} aria-label="プロフィール"><Avatar name={user.name} color={user.avatarColor} size="sm" /></Link>
          ) : (
            <Link href="/signup?next=/community" className="btn btn-primary btn-sm">参加する</Link>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-6 px-0 sm:px-4 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        {/* 左: ナビ */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 flex h-dvh flex-col py-5">
            <Link href="/" className="mb-6 flex items-center gap-2 px-3 font-serif text-lg font-bold">
              <span className="accent-bg inline-block h-6 w-6 rounded-md" aria-hidden />
              <span className="truncate">{s.siteName}</span>
            </Link>
            <SideNav handle={user?.handle ?? null} unread={unread} />
            <Link href="/" className="mt-1 flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 4h11l3 3v13H5V4Zm4 6h6M9 14h6" strokeLinejoin="round" /></svg>
              記事を読む
            </Link>
            {mine.length > 0 && (
              <div className="mt-6">
                <p className="px-3 text-xs font-bold text-muted">参加中のコミュニティ</p>
                <ul className="mt-2 space-y-0.5">
                  {mine.map((c) => (
                    <li key={c.id}>
                      <Link href={`/community/c/${c.slug}`} className="flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm hover:bg-white">
                        <span>{c.icon}</span><span className="truncate">{c.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-auto space-y-1 px-3 text-xs text-muted">
              {user ? (
                <>
                  {canEdit(user) && <Link href="/admin" className="block py-1 hover:text-fg">管理画面</Link>}
                  <Link href="/community/settings" className="block py-1 hover:text-fg">プロフィール設定</Link>
                  <form action={logout}><button className="py-1 hover:text-fg">ログアウト</button></form>
                </>
              ) : (
                <Link href="/login?next=/community" className="block py-1 hover:text-fg">ログイン</Link>
              )}
            </div>
          </div>
        </aside>

        {/* 中央 */}
        <main className="min-w-0 pb-28 pt-4 lg:pb-10 lg:pt-5">{children}</main>

        {/* 右: おすすめ */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 space-y-4 py-5">
            {!user && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <p className="font-bold">はじめての方へ</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.description}</p>
                <Link href="/signup?next=/community" className="btn btn-primary mt-4 w-full">無料で参加する</Link>
              </div>
            )}
            {upcoming.length > 0 && (
              <section className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-bold">近日のイベント</h2>
                <ul className="mt-3 space-y-3">
                  {upcoming.map((e) => (
                    <li key={e.id}>
                      <Link href={`/community/c/${e.communitySlug}?tab=events`} className="block hover:underline">
                        <p className="accent-text text-xs font-bold">{formatDateTime(e.startsAt)}</p>
                        <p className="text-sm font-bold leading-snug">{e.title}</p>
                        <p className="text-xs text-muted">{e.communityIcon} {e.communityName}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="text-sm font-bold">新しいメンバー</h2>
              <ul className="mt-3 space-y-3">
                {members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/community/u/${m.handle}`} className="flex items-center gap-3">
                      <Avatar name={m.name} color={m.avatarColor} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{m.name}</span>
                        <span className="block truncate text-xs text-muted">{m.headline}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            {reads.length > 0 && (
              <section className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-bold">注目の記事</h2>
                <ul className="mt-3 space-y-3">
                  {reads.map((a) => (
                    <li key={a.id}><Link href={`/articles/${a.slug}`} className="line-clamp-2 text-sm font-bold leading-snug hover:underline">{a.title}</Link></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </div>
      <BottomTabs handle={user?.handle ?? null} unread={unread} />
    </div>
  );
}
