"use server";

import { redirect } from "next/navigation";
import { eq, count } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword, safeNext } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#475569"];

export async function signup(_: FormState, form: FormData): Promise<FormState> {
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

  const isFirst = (db.select({ n: count() }).from(schema.users).get()?.n ?? 0) === 0;
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
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "メールアドレスかパスワードが違います" };
  }
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
