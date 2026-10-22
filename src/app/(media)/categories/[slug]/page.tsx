import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { listArticles } from "@/lib/queries";
import { ArticleCard } from "@/components/ArticleCard";
import { Pagination } from "@/components/Pagination";

const PER = 12;
const getCategory = (slug: string) => db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).get();

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const c = getCategory((await params).slug);
  return c ? { title: c.name, description: c.description, alternates: { canonical: `/categories/${c.slug}` } } : {};
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, total } = listArticles({ categoryId: c.id, limit: PER, offset: (page - 1) * PER });
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <p className="accent-text text-sm font-bold">カテゴリ</p>
      <h1 className="mt-1 font-serif text-3xl font-bold">{c.name}</h1>
      {c.description && <p className="mt-3 text-muted">{c.description}</p>}
      <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => <ArticleCard key={a.id} a={a} />)}
      </div>
      {items.length === 0 && <p className="mt-10 text-muted">まだ記事がありません。</p>}
      <Pagination page={page} total={total} perPage={PER} basePath={`/categories/${c.slug}`} />
    </div>
  );
}
