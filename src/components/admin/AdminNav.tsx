"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "ダッシュボード", exact: true },
  { href: "/admin/articles", label: "記事・固定ページ" },
  { href: "/admin/categories", label: "カテゴリ" },
  { href: "/admin/communities", label: "コミュニティ", admin: true },
  { href: "/admin/members", label: "メンバー", admin: true },
  { href: "/admin/moderation", label: "モデレーション", admin: true },
  { href: "/admin/settings", label: "サイト設定", admin: true },
  { href: "/admin/integrations", label: "外部連携", admin: true },
  { href: "/admin/import", label: "WordPress から移行", admin: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="管理メニュー">
      {ITEMS.filter((i) => isAdmin || !i.admin).map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-white/15 font-bold text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
