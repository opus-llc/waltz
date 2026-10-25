/**
 * 旧サイトの URL を、転送表（redirects.from_path）と照合できる形にそろえる。
 * 取り込み時と、リクエスト時（src/proxy.ts）の両方で同じ関数を使う。
 *
 * - %エンコードをデコードし、NFC に正規化（日本語スラッグの表記ゆれを吸収）
 * - 小文字化・連続スラッシュの圧縮・末尾スラッシュの除去
 * - クエリは WordPress の ID 指定（/?p=123、サブディレクトリなら /blog/?p=123）だけを残す
 */
const ID_PARAMS = ["p", "page_id", "cat", "tag"] as const;

export function normalizeLegacyPath(pathname: string, search: URLSearchParams | string = ""): string | null {
  let p = pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    // 不正な %エンコードはそのまま使う
  }
  if (!p.startsWith("/") || /[\x00-\x1f\x7f]/.test(p)) return null;
  p = p.normalize("NFC").toLowerCase().replace(/\/{2,}/g, "/");
  // 末尾の / と index.php を落とす（"" はサイトのトップ）
  const base = p.replace(/\/index\.php$/, "").replace(/\/+$/, "");
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  for (const k of ID_PARAMS) {
    const v = q.get(k);
    if (v && /^[\w%-]{1,200}$/.test(v)) return `${base}/?${k}=${v.toLowerCase()}`;
  }
  if (!base) return null;
  p = base;
  return p.length <= 1000 ? p : null;
}

/** waltz 自身の URL。旧 URL がこれらと重なる場合は転送を作らない（既存ページを隠してしまうため） */
const OWN_PREFIXES = ["/articles", "/p", "/categories", "/tags", "/community", "/admin", "/api", "/uploads", "/login", "/signup", "/_next"];
const OWN_FILES = ["/feed.xml", "/robots.txt", "/sitemap.xml", "/llms.txt", "/favicon.ico"];

export function collidesWithOwnRoute(normalized: string): boolean {
  if (normalized.startsWith("/?")) return false;
  if (OWN_FILES.includes(normalized)) return true;
  return OWN_PREFIXES.some((pre) => normalized === pre || normalized.startsWith(`${pre}/`));
}
