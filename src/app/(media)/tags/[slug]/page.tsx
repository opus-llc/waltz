import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { listArticles } from "@/lib/queries";
import { ArticleCard } from "@/components/ArticleCard";

const getTag = (slug: string) => db.select().from(schema.tags).where(eq(schema.tags.slug, slug)).get();

export async function generateMetadata({ params }: PageProps<"/tags/[slug]">): Promise<Metadata> {
  const t = getTag((await params).slug);
  return t ? { title: `#${t.name}`, alternates: { canonical: `/tags/${t.slug}` } } : {};
}

export default async function TagPage({ params }: PageProps<"/tags/[slug]">) {
  const t = getTag((await params).slug);
  if (!t) notFound();
  const { items } = listArticles({ tagId: t.id, limit: 60 });
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <p className="accent-text text-sm font-bold">タグ</p>
      <h1 className="mt-1 font-serif text-3xl font-bold">#{t.name}</h1>
      <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => <ArticleCard key={a.id} a={a} />)}
      </div>
    </div>
  );
}
