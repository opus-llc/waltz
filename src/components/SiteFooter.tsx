import Link from "next/link";
import { communityOn, getSettings } from "@/lib/settings";
import { categoriesWithCounts, getPublishedArticle } from "@/lib/queries";
import { withBase } from "@/lib/base-path";

export function SiteFooter() {
  const s = getSettings();
  const cats = categoriesWithCounts();
  // 固定ページは作られているものだけ出す（無いページへのリンクを置かない）
  const hasPage = (slug: string) => !!getPublishedArticle(slug, "page");
  return (
    <footer className="mt-24 border-t border-line bg-soft">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-serif text-lg font-bold">{s.siteName}</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{s.description}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-muted">カテゴリ</p>
          <ul className="mt-3 space-y-2 text-sm">
            {cats.map((c) => (
              <li key={c.id}><Link href={`/categories/${c.slug}`} className="hover:underline">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-muted">サイトについて</p>
          <ul className="mt-3 space-y-2 text-sm">
            {hasPage("about") && <li><Link href="/p/about" className="hover:underline">このサイトについて</Link></li>}
            {communityOn(s) && <li><Link href="/community" className="hover:underline">コミュニティ</Link></li>}
            {hasPage("privacy") && <li><Link href="/p/privacy" className="hover:underline">プライバシーポリシー</Link></li>}
            <li><a href={withBase("/feed.xml")} className="hover:underline">RSS</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted">
          <span>{s.footerNote || `© ${s.siteName}`}</span>
          <span>Powered by <span className="font-bold">waltz</span>（オープンソース）</span>
        </div>
      </div>
    </footer>
  );
}
