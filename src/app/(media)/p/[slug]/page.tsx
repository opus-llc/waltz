import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedArticle } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const row = getPublishedArticle((await params).slug, "page");
  if (!row) return {};
  const a = row.article;
  return { title: a.seoTitle || a.title, description: a.seoDescription || a.excerpt, alternates: { canonical: `/p/${a.slug}` } };
}

export default async function FixedPage({ params }: PageProps<"/p/[slug]">) {
  const row = getPublishedArticle((await params).slug, "page");
  if (!row) notFound();
  const { html } = renderMarkdown(row.article.body);
  return (
    <article className="mx-auto max-w-2xl px-4 pt-12">
      <h1 className="headline font-serif text-3xl font-bold leading-snug">{row.article.title}</h1>
      <div className="prose-ja mt-10" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
