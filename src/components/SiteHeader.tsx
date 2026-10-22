import Link from "next/link";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { categoriesWithCounts, unreadCount } from "@/lib/queries";
import { Avatar } from "./Avatar";

export async function SiteHeader() {
  const s = getSettings();
  const user = await getCurrentUser();
  const cats = categoriesWithCounts().slice(0, 4);
  const unread = user ? unreadCount(user.id) : 0;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-serif text-lg font-bold">
          <span className="accent-bg inline-block h-6 w-6 shrink-0 rounded-md" aria-hidden />
          <span className="truncate">{s.siteName}</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted md:flex" aria-label="カテゴリ">
          <Link href="/articles" className="hover:text-fg">記事一覧</Link>
          {cats.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="hover:text-fg">{c.name}</Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/community" className="btn btn-primary btn-sm">
            コミュニティ{unread > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs">{unread}</span>}
          </Link>
          {user ? (
            <>
              {canEdit(user) && <Link href="/admin" className="btn btn-ghost btn-sm hidden sm:inline-flex">管理画面</Link>}
              <Link href={`/community/u/${user.handle}`} aria-label="プロフィール">
                <Avatar name={user.name} color={user.avatarColor} size="sm" />
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-ghost btn-sm">ログイン</Link>
          )}
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 text-sm text-muted md:hidden" aria-label="カテゴリ">
        <Link href="/articles" className="shrink-0">記事一覧</Link>
        {cats.map((c) => (
          <Link key={c.id} href={`/categories/${c.slug}`} className="shrink-0">{c.name}</Link>
        ))}
      </nav>
    </header>
  );
}
