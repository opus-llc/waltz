import { requireEditor } from "@/lib/auth";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDate, nowMs } from "@/lib/format";

export default async function AdminArticles({ searchParams }: PageProps<"/admin/articles">) {
  await requireEditor();
  const type = (await searchParams).type === "page" ? "page" : "post";
  const rows = db
    .select({ a: schema.articles, cat: schema.categories.name, author: schema.users.name })
    .from(schema.articles)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.articles.categoryId))
    .leftJoin(schema.users, eq(schema.users.id, schema.articles.authorId))
    .where(eq(schema.articles.type, type))
    .orderBy(desc(schema.articles.updatedAt))
    .all();
  const now = nowMs();
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">記事・固定ページ</h1>
        <Link href={`/admin/articles/new${type === "page" ? "?type=page" : ""}`} className="btn btn-primary">＋ 新規作成</Link>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href="/admin/articles" className={`btn btn-sm ${type === "post" ? "btn-primary" : "btn-ghost"}`}>記事</Link>
        <Link href="/admin/articles?type=page" className={`btn btn-sm ${type === "page" ? "btn-primary" : "btn-ghost"}`}>固定ページ</Link>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-soft text-left text-xs text-muted">
            <tr><th className="px-4 py-3">タイトル</th><th className="px-4 py-3">状態</th><th className="px-4 py-3">カテゴリ</th><th className="px-4 py-3">公開日</th><th className="px-4 py-3">更新</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ a, cat }) => {
              const scheduled = a.status === "published" && a.publishedAt && a.publishedAt.getTime() > now;
              return (
                <tr key={a.id} className="hover:bg-soft">
                  <td className="px-4 py-3">
                    <Link href={`/admin/articles/${a.id}`} className="font-bold hover:underline">{a.title}</Link>
                    {a.featured && <span className="accent-text ml-2 text-xs font-bold">注目</span>}
                    <p className="text-xs text-muted">/{a.type === "page" ? "p" : "articles"}/{a.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scheduled ? "bg-sky-100 text-sky-800" : a.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {scheduled ? "予約" : a.status === "published" ? "公開中" : "下書き"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{cat ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(a.publishedAt)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(a.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-muted">まだありません</p>}
      </div>
    </div>
  );
}
