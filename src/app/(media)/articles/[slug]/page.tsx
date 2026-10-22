import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticle, getArticleTags, listArticles, feed, joinedCommunities } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ArticleCover } from "@/components/ArticleCover";
import { ArticleCard } from "@/components/ArticleCard";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const row = getPublishedArticle((await params).slug);
  if (!row) return {};
  const a = row.article;
  const title = a.seoTitle || a.title;
  const description = a.seoDescription || a.excerpt;
  return {
    title,
    description,
    alternates: { canonical: `/articles/${a.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: a.publishedAt?.toISOString(),
      modifiedTime: a.updatedAt.toISOString(),
      ...(a.coverUrl ? { images: [a.coverUrl] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const row = getPublishedArticle((await params).slug);
  if (!row) notFound();
  const a = row.article;
  const s = getSettings();
  const user = await getCurrentUser();
  const { html, toc } = renderMarkdown(a.body);
  const tagList = getArticleTags(a.id);
  const related = listArticles({ categoryId: a.categoryId ?? undefined, excludeId: a.id, limit: 3 }).items;
  const discussion = feed({ articleId: a.id, viewerId: user?.id, limit: 10 });
  const myCommunities = user ? joinedCommunities(user.id) : [];
  const url = `${s.siteUrl}/articles/${a.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.excerpt,
      datePublished: a.publishedAt?.toISOString(),
      dateModified: a.updatedAt.toISOString(),
      author: row.authorName ? { "@type": "Person", name: row.authorName } : undefined,
      publisher: { "@type": "Organization", name: s.siteName },
      mainEntityOfPage: url,
      ...(a.coverUrl ? { image: a.coverUrl.startsWith("/") ? `${s.siteUrl}${a.coverUrl}` : a.coverUrl } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: s.siteName, item: s.siteUrl },
        ...(row.categorySlug ? [{ "@type": "ListItem", position: 2, name: row.categoryName, item: `${s.siteUrl}/categories/${row.categorySlug}` }] : []),
        { "@type": "ListItem", position: row.categorySlug ? 3 : 2, name: a.title, item: url },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-3xl px-4 pt-8">
        <nav className="text-xs text-muted" aria-label="パンくず">
          <Link href="/" className="hover:underline">ホーム</Link>
          {row.categorySlug && <> / <Link href={`/categories/${row.categorySlug}`} className="hover:underline">{row.categoryName}</Link></>}
        </nav>
        <h1 className="headline mt-4 font-serif text-[1.75rem] font-bold leading-snug sm:text-4xl sm:leading-tight">{a.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          {row.authorName && (
            <Link href={`/community/u/${row.authorHandle}`} className="flex items-center gap-2 hover:text-fg">
              <Avatar name={row.authorName} color={row.authorColor ?? "#64748b"} size="xs" />
              {row.authorName}
            </Link>
          )}
          <time dateTime={a.publishedAt?.toISOString()}>{formatDate(a.publishedAt)}</time>
          {a.updatedAt.getTime() - (a.publishedAt?.getTime() ?? 0) > 86400_000 && <span>更新 {formatDate(a.updatedAt)}</span>}
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl">
          <ArticleCover title={a.title} coverUrl={a.coverUrl} coverAlt={a.coverAlt} label={row.categoryName} size="lg" />
        </div>
        {a.excerpt && <p className="mt-8 text-lg leading-relaxed text-muted">{a.excerpt}</p>}

        {toc.length >= 3 && (
          <nav className="mt-10 rounded-2xl bg-soft p-6" aria-label="目次">
            <p className="text-sm font-bold">目次</p>
            <ol className="mt-3 space-y-2 text-sm">
              {toc.map((t) => (
                <li key={t.id} className={t.level === 3 ? "pl-4" : ""}>
                  <a href={`#${t.id}`} className="hover:underline">{t.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="prose-ja mt-10" dangerouslySetInnerHTML={{ __html: html }} />

        {tagList.length > 0 && (
          <ul className="mt-12 flex flex-wrap gap-2">
            {tagList.map((t) => (
              <li key={t.id}><Link href={`/tags/${t.slug}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-sm hover:bg-soft">#{t.name}</Link></li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(a.title)}&url=${encodeURIComponent(url)}`}>Xで共有</a>
          <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedInで共有</a>
        </div>

        {/* 記事 → コミュニティ */}
        <section id="discussion" className="mt-16 rounded-3xl border border-line bg-soft p-5 sm:p-8">
          <h2 className="font-serif text-xl font-bold">この記事について話す</h2>
          <p className="mt-1 text-sm text-muted">感想や自社でのやり方を、コミュニティで共有しましょう。</p>
          <div className="mt-5 rounded-2xl bg-white p-4">
            {user ? (
              <Composer communities={myCommunities} defaultCommunityId={myCommunities[0]?.id} articleId={a.id} placeholder="この記事を読んで考えたこと、自社でのやり方など" compact />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">ログインすると、この記事をコミュニティで共有できます。</p>
                <div className="flex gap-2">
                  <Link href={`/signup?next=/articles/${a.slug}%23discussion`} className="btn btn-primary btn-sm">無料で参加する</Link>
                  <Link href={`/login?next=/articles/${a.slug}%23discussion`} className="btn btn-ghost btn-sm">ログイン</Link>
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 space-y-3">
            {discussion.map((p) => <PostCard key={p.id} post={p} viewer={user} />)}
            {discussion.length === 0 && <p className="text-sm text-muted">まだ会話はありません。最初のひとことをどうぞ。</p>}
          </div>
        </section>
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-4">
          <h2 className="mb-6 border-b border-line pb-3 font-serif text-xl font-bold">関連する記事</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {related.map((r) => <ArticleCard key={r.id} a={r} />)}
          </div>
        </section>
      )}
    </>
  );
}
