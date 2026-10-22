import { requireEditor } from "@/lib/auth";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toJstLocal, nowMs } from "@/lib/format";
import { getArticleTags } from "@/lib/queries";
import { deleteArticle } from "@/app/actions/admin";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { PartnerCard } from "@/components/admin/PartnerCard";

export default async function EditArticle({ params, searchParams }: PageProps<"/admin/articles/[id]">) {
  await requireEditor();
  const a = db.select().from(schema.articles).where(eq(schema.articles.id, Number((await params).id))).get();
  if (!a) notFound();
  const saved = (await searchParams).saved;
  const categories = db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(schema.categories.sort).all();
  const live = a.status === "published" && a.publishedAt && a.publishedAt.getTime() <= nowMs();
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{a.type === "page" ? "固定ページを編集" : "記事を編集"}</h1>
        <form action={deleteArticle}>
          <input type="hidden" name="id" value={a.id} />
          <details className="relative">
            <summary className="btn btn-ghost btn-sm cursor-pointer list-none text-red-600">削除</summary>
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
              <p>この{a.type === "page" ? "ページ" : "記事"}を削除します。元に戻せません。</p>
              <button className="btn btn-sm mt-3 w-full bg-red-600 text-white">削除する</button>
            </div>
          </details>
        </form>
      </div>
      {saved && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">保存しました</p>}
      <ArticleEditor
        initial={{
          id: a.id,
          type: a.type,
          title: a.title,
          slug: a.slug,
          body: a.body,
          excerpt: a.excerpt,
          coverUrl: a.coverUrl,
          coverAlt: a.coverAlt,
          categoryId: a.categoryId,
          featured: a.featured,
          seoTitle: a.seoTitle,
          seoDescription: a.seoDescription,
          status: a.status,
          publishedAt: toJstLocal(a.publishedAt),
          tags: getArticleTags(a.id).map((t) => t.name).join(", "),
        }}
        categories={categories}
        partner={<PartnerCard kind="content" />}
        publicUrl={live ? `/${a.type === "page" ? "p" : "articles"}/${a.slug}` : null}
      />
    </div>
  );
}
