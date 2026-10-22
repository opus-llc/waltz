import type { Metadata } from "next";
import Link from "next/link";
import { requireEditor, isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AdminNav } from "@/components/admin/AdminNav";
import { PARTNERS } from "@/lib/partners";

export const metadata: Metadata = { title: "管理画面", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireEditor();
  const s = getSettings();
  return (
    <div className="min-h-dvh bg-soft lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="bg-[#1c1f24] text-white lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex h-full flex-col gap-4 p-4">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="accent-bg inline-block h-6 w-6 shrink-0 rounded-md" aria-hidden />
            <span className="truncate">{s.siteName}</span>
          </Link>
          <AdminNav isAdmin={isAdmin(user)} />
          <div className="mt-auto hidden space-y-2 text-xs text-white/60 lg:block">
            <Link href="/" className="block hover:text-white">サイトを見る ↗</Link>
            <Link href="/community" className="block hover:text-white">コミュニティを見る ↗</Link>
            {s.showPartnerLinks === "1" && (
              <a href={PARTNERS.custom.url} target="_blank" rel="noopener" className="block pt-3 hover:text-white">{PARTNERS.custom.action} ↗</a>
            )}
            <p className="pt-2">{user.name}（{user.role === "admin" ? "管理者" : "編集者"}）</p>
          </div>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
