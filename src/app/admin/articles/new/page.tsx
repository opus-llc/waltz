import { requireEditor } from "@/lib/auth";
import { db, schema } from "@/db";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { PartnerCard } from "@/components/admin/PartnerCard";

export default async function NewArticle({ searchParams }: PageProps<"/admin/articles/new">) {
  await requireEditor();
  const type = (await searchParams).type === "page" ? "page" : "post";
  const categories = db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).orderBy(schema.categories.sort).all();
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-xl font-bold">{type === "page" ? "固定ページを作成" : "記事を作成"}</h1>
      <ArticleEditor
        initial={{ type, title: "", slug: "", body: "", excerpt: "", coverUrl: "", coverAlt: "", categoryId: null, featured: false, seoTitle: "", seoDescription: "", status: "draft", publishedAt: "", tags: "", ctaKey: "", relatedSlugs: "", relatedLinks: "" }}
        categories={categories}
        partner={<PartnerCard kind="content" />}
        publicUrl={null}
      />
    </div>
  );
}
