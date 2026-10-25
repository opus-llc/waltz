import Database from "better-sqlite3";
import { DB_PATH } from "../db/connect";
import { collidesWithOwnRoute, normalizeLegacyPath } from "./legacy-path";

/**
 * src/proxy.ts から呼ぶ転送表の照会。"server-only" の付いた src/db を経由せず、
 * 同じプロセスにアプリの接続があればそれを、なければ読み取り専用の接続を開いて使う。
 */
type Conn = { stmt: Database.Statement<[string], { to_path: string }> };
const g = globalThis as unknown as {
  __waltzDb?: { sqlite: Database.Database };
  __waltzRedirects?: Conn;
  __waltzRedirectsRetryAt?: number;
};

function conn(): Conn | null {
  if (g.__waltzRedirects) return g.__waltzRedirects;
  if ((g.__waltzRedirectsRetryAt ?? 0) > Date.now()) return null;
  try {
    const sqlite = g.__waltzDb?.sqlite ?? new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const stmt = sqlite.prepare<[string], { to_path: string }>("SELECT to_path FROM redirects WHERE from_path = ?");
    g.__waltzRedirects = { stmt };
    return g.__waltzRedirects;
  } catch {
    // DB や表がまだ無い（初回起動前）。10秒後にもう一度試す
    g.__waltzRedirectsRetryAt = Date.now() + 10_000;
    return null;
  }
}

export function findRedirect(pathname: string, search: URLSearchParams): string | null {
  const key = normalizeLegacyPath(pathname, search);
  // waltz 自身の URL（記事・管理画面・画像など）は転送表に載らないので、DB を引かない
  if (!key || collidesWithOwnRoute(key)) return null;
  const c = conn();
  if (!c) return null;
  try {
    const to = c.stmt.get(key)?.to_path;
    // 転送先は同じサイト内のパスだけ（"//evil" を弾く）
    return to && to.startsWith("/") && !to.startsWith("//") ? to : null;
  } catch {
    return null;
  }
}
