/**
 * 記事の URL の置き場。ビルド時に NEXT_PUBLIC_ARTICLE_PATH で決まる。
 * 未設定なら /articles/{slug}。空文字にするとサイト直下の /{slug}（WordPress の「投稿名」と同じ形）。
 * 中身のページは常に /articles/[slug] にあり、違う置き場は src/proxy.ts が内部で書き換える。
 */
const raw = process.env.NEXT_PUBLIC_ARTICLE_PATH;
export const ARTICLE_ROOT = raw === undefined ? "/articles" : raw.replace(/^\/+|\/+$/g, "") ? `/${raw.replace(/^\/+|\/+$/g, "")}` : "";

export const articlePath = (slug: string) => `${ARTICLE_ROOT}/${slug}`;

/** waltz 自身のページの先頭の名前。サイト直下に記事を置くとき、これと同じスラッグは使えない */
export const RESERVED_SEGMENTS = new Set([
  "articles", "p", "categories", "tags", "community", "admin", "api", "uploads", "login", "signup", "wp-json", "_next",
]);

export const isReservedSlug = (slug: string) => ARTICLE_ROOT === "" && RESERVED_SEGMENTS.has(slug);
