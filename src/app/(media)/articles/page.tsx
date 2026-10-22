import type { Metadata } from "next";
import { listArticles } from "@/lib/queries";
import { ArticleCard } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = { title: "記事一覧", alternates: { canonical: "/articles" } };
const PER = 12;

export default async function ArticlesPage({ searchParams }: PageProps<"/articles">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = listArticles({ q: q || undefined, limit: PER, offset: (page - 1) * PER });
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <h1 className="font-serif text-3xl font-bold">記事一覧</h1>
      <form className="mt-6 flex max-w-lg gap-2" role="search">
        <label htmlFor="q" className="sr-only">記事を検索</label>
        <input id="q" name="q" defaultValue={q} placeholder="キーワードで探す" className="field" />
        <button className="btn btn-primary shrink-0">検索</button>
      </form>
      {q && <p className="mt-4 text-sm text-muted">「{q}」の検索結果：{total}件</p>}
      <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => <ArticleCard key={a.id} a={a} />)}
      </div>
      {items.length === 0 && <p className="mt-10 text-muted">記事が見つかりませんでした。</p>}
      <Pagination page={page} total={total} perPage={PER} basePath="/articles" query={q ? { q } : {}} />
    </div>
  );
}
