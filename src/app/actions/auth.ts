"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hit, clear } from "@/lib/rate-limit";
import { eq, count } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword, safeNext } from "@/lib/auth";
import { communityOn, getSettings } from "@/lib/settings";

export type FormState = { error?: string; ok?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#475569"];

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  if (!hit(`signup:${await clientIp()}`, 5, 60 * 60_000).ok) return { error: "登録の試行が多すぎます。時間をおいてお試しください" };
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const handle = String(form.get("handle") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const headline = String(form.get("headline") ?? "").trim().slice(0, 60);

  if (!name || name.length > 40) return { error: "表示名を40文字以内で入力してください" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "メールアドレスの形式が正しくありません" };
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return { error: "ユーザー名は半角英数字と _ で3〜20文字にしてください" };
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください" };
  if (db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get())
    return { error: "このメールアドレスは登録済みです" };
  if (db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.handle, handle)).get())
    return { error: "このユーザー名は使われています" };

  // 管理者になれるのは ADMIN_EMAIL と一致する人だけ。未設定なら開発環境に限り最初の登録者を管理者にする
  // （本番で「最初に登録した誰か」がサイトを乗っ取れないようにするため）
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const noUsers = (db.select({ n: count() }).from(schema.users).get()?.n ?? 0) === 0;
  const isFirst = adminEmail ? email === adminEmail : noUsers && process.env.NODE_ENV !== "production";
  // コミュニティを閉じたサイト（記事メディアとして使う）では、管理者以外の登録を受け付けない
  if (!isFirst && !communityOn(getSettings())) return { error: "このサイトでは会員登録を受け付けていません" };
  const user = db
    .insert(schema.users)
    .values({
      name,
      email,
      handle,
      headline,
      passwordHash: hashPassword(password),
      role: isFirst ? "admin" : "member",
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
    .returning({ id: schema.users.id })
    .get();
  await createSession(user.id);
  redirect(isFirst ? "/admin" : safeNext(form.get("next"), "/community/explore?welcome=1"));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // 同じ接続元から15分に20回、同じアカウントへ15分に10回まで
  const ip = await clientIp();
  const byIp = hit(`login-ip:${ip}`, 20, 15 * 60_000);
  const byAccount = hit(`login-acct:${email}`, 10, 15 * 60_000);
  if (!byIp.ok || !byAccount.ok) {
    return { error: `ログインの試行が多すぎます。${Math.ceil(Math.max(byIp.retryAfterSec, byAccount.retryAfterSec) / 60)}分ほどおいてお試しください` };
  }
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "メールアドレスかパスワードが違います" };
  }
  clear(`login-acct:${email}`);
  await createSession(user.id);
  // コミュニティを閉じたサイトでは、編集者以上は管理画面へ、それ以外はトップへ
  const home = communityOn(getSettings()) ? "/community" : user.role === "member" ? "/" : "/admin";
  redirect(safeNext(form.get("next"), home));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
