import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq, and, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
export { hashPassword, verifyPassword } from "./password";

const COOKIE = "ens_session";
const SESSION_DAYS = 30;

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt }).run();
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run();
  jar.delete(COOKIE);
}

export type SafeUser = Omit<User, "passwordHash">;

export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .get();
  if (!row) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = row.user;
  return safe;
});

export async function requireUser(next = "/community"): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export const canEdit = (u: SafeUser | null) => !!u && (u.role === "admin" || u.role === "editor");
export const isAdmin = (u: SafeUser | null) => !!u && u.role === "admin";

/** 管理画面の処理の入口で必ず呼ぶ。画面を隠すだけでは権限確認にならない */
export async function requireEditor(): Promise<SafeUser> {
  const user = await requireUser("/admin");
  if (!canEdit(user)) redirect("/community?denied=1");
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser("/admin");
  if (!isAdmin(user)) redirect("/admin?denied=1");
  return user;
}

/** ログイン後の戻り先。同じサイト内のパスだけを許す（"//evil"・"/\\evil"・制御文字入りの "/\t/evil" を弾く） */
export function safeNext(next: unknown, fallback = "/community"): string {
  if (typeof next !== "string" || !next.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(next)) return fallback;
  try {
    const base = "http://same.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
