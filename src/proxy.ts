import { NextResponse, type NextRequest } from "next/server";
import { findRedirect } from "@/lib/redirect-lookup";
import { ARTICLE_ROOT, RESERVED_SEGMENTS } from "@/lib/paths";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 記事の置き場が /articles 以外のとき、公開 URL → 中身のページ（/articles/{slug}）の対応 */
function articleRewrite(pathname: string): string | null {
  if (ARTICLE_ROOT === "/articles") return null;
  const rest = ARTICLE_ROOT ? (pathname.startsWith(`${ARTICLE_ROOT}/`) ? pathname.slice(ARTICLE_ROOT.length + 1) : null) : pathname.slice(1);
  if (!rest || !SLUG.test(rest) || (!ARTICLE_ROOT && RESERVED_SEGMENTS.has(rest))) return null;
  return `/articles/${rest}`;
}

/**
 * 旧サイト（WordPress など）の URL を、転送表（redirects）にもとづいて 301 で新しい URL へ送る。
 * request.nextUrl.pathname は basePath を除いた値で、clone した URL は basePath を付けて組み立て直される。
 *
 * WordPress の URL は末尾が「/」のため、Next.js 標準の末尾スラッシュ除去（308）を next.config の
 * skipTrailingSlashRedirect で止め、ここで「転送表にあれば 301、なければ 308 で末尾を外す」を1回で行う。
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams, search, basePath } = request.nextUrl;
  if (request.method === "GET" || request.method === "HEAD") {
    const to = findRedirect(pathname, searchParams);
    if (to) return redirect(request, `${basePath}${to}`, "", 301);
  }
  if (ARTICLE_ROOT !== "/articles" && (request.method === "GET" || request.method === "HEAD")) {
    // 中身のページの URL で来たら、公開 URL へ 301（同じ記事が2つの URL に出ないように）
    const m = pathname.match(/^\/articles\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (m) return redirect(request, `${basePath}${ARTICLE_ROOT}/${m[1]}`, search, 301);
    const internal = articleRewrite(pathname);
    if (internal) {
      const url = new URL(request.nextUrl.href);
      url.pathname = `${basePath}${internal}`;
      return NextResponse.rewrite(url);
    }
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    // 先頭の連続スラッシュも1つにする（"//evil.example/" が Location: //evil.example にならないように）
    const clean = pathname.replace(/^\/+/, "/").replace(/\/+$/, "") || "/";
    return redirect(request, `${basePath}${clean}`, search, 308);
  }
}

/** nextUrl.clone() は skipTrailingSlashRedirect 下で元の末尾スラッシュを付け直すため、素の URL で組み立てる */
function redirect(request: NextRequest, path: string, search: string, status: 301 | 308) {
  const url = new URL(request.nextUrl.href);
  url.pathname = path;
  url.search = search;
  return NextResponse.redirect(url, status);
}

export const config = {
  // API は対象外（proxy を通る本文は 10MB で切られるため。取り込みの XML は最大 50MB）。
  // wp-json（concerto・sonata 向けの口）も、旧サイトの転送や末尾スラッシュの 308 を挟まない
  matcher: ["/((?!_next/|api/|wp-json).*)"],
};
