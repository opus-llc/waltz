import { NextResponse, type NextRequest } from "next/server";
import { findRedirect } from "@/lib/redirect-lookup";

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
  // API は対象外（proxy を通る本文は 10MB で切られるため。取り込みの XML は最大 50MB）
  matcher: ["/((?!_next/|api/).*)"],
};
