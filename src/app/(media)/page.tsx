import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { featuredArticles, listArticles, listCommunities, feed, communityEvents, categoriesWithCounts } from "@/lib/queries";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleCover } from "@/components/ArticleCover";
import { Avatar } from "@/components/Avatar";
import { PostBody } from "@/components/PostBody";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";

export default function Home() {
  const s = getSettings();
  const featured = featuredArticles(3);
  const hero = featured[0] ?? listArticles({ limit: 1 }).items[0];
  const { items: latest } = listArticles({ limit: 6 });
  const communities = listCommunities().slice(0, 4);
  const talk = feed({ limit: 3 });
  const upcoming = communityEvents(undefined, { upcomingOnly: true, limit: 3 });
  const cats = categoriesWithCounts();

  return (
    <>
      {/* ヒーロー */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-[1fr_1.15fr] md:pt-16">
        <div>
          <p className="accent-text text-sm font-bold">{s.siteName}</p>
          <h1 className="headline mt-3 font-serif text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.75rem]">{s.tagline}</h1>
          <p className="mt-5 max-w-lg leading-relaxed text-muted">{s.description}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/articles" className="btn btn-primary">記事を読む</Link>
            <Link href="/community" className="btn btn-ghost">コミュニティをのぞく</Link>
          </div>
        </div>
        {hero && (
          <Link href={`/articles/${hero.slug}`} className="group block">
            <div className="overflow-hidden rounded-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)]">
              <ArticleCover title={hero.title} coverUrl={hero.coverUrl} coverAlt={hero.coverAlt} label={hero.categoryName} size="lg" />
            </div>
            <p className="mt-3 text-sm text-muted">
              <span className="accent-text font-bold">注目</span>・{formatDate(hero.publishedAt)}
            </p>
          </Link>
        )}
      </section>

      {/* 注目記事 */}
      {featured.length > 1 && (
        <section className="mx-auto max-w-6xl px-4">
          <SectionTitle title="注目の記事" />
          <div className="grid gap-8 sm:grid-cols-2">
            {featured.slice(1).map((a) => <ArticleCard key={a.id} a={a} />)}
          </div>
        </section>
      )}

      {/* 新着 */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <SectionTitle title="新着記事" href="/articles" />
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((a) => <ArticleCard key={a.id} a={a} />)}
        </div>
      </section>

      {/* 記事 → コミュニティ */}
      <section className="mt-20 bg-soft py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-2xl">
            <p className="accent-text text-sm font-bold">COMMUNITY</p>
            <h2 className="headline mt-2 font-serif text-2xl font-bold sm:text-3xl">読んだら、話そう。</h2>
            <p className="mt-3 leading-relaxed text-muted">記事の感想や、自社でのやり方。同じ仕事をしている人たちと、ここで相談できます。</p>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <p className="text-sm font-bold">いま話されていること</p>
              {talk.map((p) => (
                <Link key={p.id} href={`/community/posts/${p.id}`} className="block rounded-2xl border border-line bg-white p-4 transition hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.author.name} color={p.author.avatarColor} size="sm" />
                    <div className="min-w-0 text-sm">
                      <p className="font-bold">{p.author.name}</p>
                      <p className="truncate text-xs text-muted">{p.author.headline}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-muted">{timeAgo(p.createdAt)}</span>
                  </div>
                  <div className="mt-3 text-sm"><PostBody text={p.body} clamp plain /></div>
                  <p className="mt-3 text-xs text-muted">
                    {p.community && <span>{p.community.icon} {p.community.name}・</span>}♡ {p.likeCount}・コメント {p.commentCount}
                  </p>
                </Link>
              ))}
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-bold">コミュニティ</p>
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                  {communities.map((c) => (
                    <li key={c.id}>
                      <Link href={`/community/c/${c.slug}`} className="flex items-center gap-3 p-4 hover:bg-soft">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${c.color}1a` }}>{c.icon}</span>
                        <span className="min-w-0">
                          <span className="block font-bold">{c.name}</span>
                          <span className="block text-xs text-muted">{c.memberCount}人が参加</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {upcoming.length > 0 && (
                <div>
                  <p className="text-sm font-bold">近日のイベント</p>
                  <ul className="mt-3 space-y-2">
                    {upcoming.map((e) => (
                      <li key={e.id}>
                        <Link href={`/community/c/${e.communitySlug}?tab=events`} className="block rounded-2xl border border-line bg-white p-4 hover:bg-soft">
                          <p className="accent-text text-xs font-bold">{formatDateTime(e.startsAt)}</p>
                          <p className="mt-1 font-bold">{e.title}</p>
                          <p className="mt-1 text-xs text-muted">{e.communityIcon} {e.communityName}・{e.location}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* カテゴリ */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <SectionTitle title="カテゴリから探す" />
        <div className="grid gap-4 sm:grid-cols-3">
          {cats.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="rounded-2xl border border-line p-5 transition hover:border-[var(--accent)]">
              <p className="font-bold">{c.name}</p>
              <p className="mt-1 text-sm text-muted">{c.description}</p>
              <p className="accent-text mt-3 text-xs font-bold">{c.n}本の記事 →</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between border-b border-line pb-3">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {href && <Link href={href} className="accent-text text-sm font-bold">すべて見る →</Link>}
    </div>
  );
}
