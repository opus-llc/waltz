"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number; match: (p: string) => boolean };

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export function navItems(handle: string | null, unread: number): Item[] {
  return [
    { href: "/community", label: "ホーム", icon: <Icon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />, match: (p) => p === "/community" || p.startsWith("/community/posts") },
    { href: "/community/explore", label: "探す", icon: <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" />, match: (p) => p.startsWith("/community/explore") || p.startsWith("/community/c/") },
    { href: "/community/notifications", label: "通知", badge: unread, icon: <Icon d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Zm4 11a2 2 0 0 0 4 0" />, match: (p) => p.startsWith("/community/notifications") },
    {
      href: handle ? `/community/u/${handle}` : "/login?next=/community",
      label: handle ? "プロフィール" : "ログイン",
      icon: <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5a7.5 7.5 0 0 1 15 0" />,
      match: (p) => (!!handle && p === `/community/u/${handle}`) || p.startsWith("/community/settings"),
    },
  ];
}

export function SideNav({ handle, unread }: { handle: string | null; unread: number }) {
  const path = usePathname();
  const items = navItems(handle, unread);
  return (
    <nav aria-label="コミュニティ" className="space-y-1">
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] transition ${active ? "accent-soft accent-text font-bold" : "hover:bg-white"}`}
          >
            {it.icon}
            <span>{it.label}</span>
            {!!it.badge && <span className="accent-bg ml-auto rounded-full px-2 text-xs font-bold text-white">{it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ handle, unread }: { handle: string | null; unread: number }) {
  const path = usePathname();
  const items = navItems(handle, unread);
  return (
    <nav
      aria-label="コミュニティ"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "accent-text font-bold" : "text-muted"}`}
          >
            {it.icon}
            {it.label}
            {!!it.badge && <span className="accent-bg absolute right-[28%] top-1.5 min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold leading-[18px] text-white">{it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
