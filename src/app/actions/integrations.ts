"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { saveSettings } from "@/lib/settings";
import { issueToken, revokeToken } from "@/lib/integrations/tokens";
import type { FormState } from "./auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = "/admin/integrations";

export async function saveConcerto(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  if (isDemo()) return { error: "デモ環境では計測タグは保存されません" };
  // concerto の「計測タグ」のコードを丸ごと貼られても、中の UUID（data-site="…" / site:"…"）を取り出す
  const raw = String(form.get("concertoSiteId") ?? "").trim();
  const siteId = (raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? raw).toLowerCase();
  const origin = String(form.get("concertoOrigin") ?? "").trim().replace(/\/+$/, "");
  if (siteId && !UUID.test(siteId)) return { error: "concerto のメディア詳細「計測タグ」のコードを、そのまま貼ってください" };
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return { error: "concerto のURLは https:// から入力してください" };
  }
  if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search) return { error: "concerto のURLは https://ドメイン の形で入力してください" };
  saveSettings({ concertoSiteId: siteId, concertoOrigin: parsed.origin });
  revalidatePath("/", "layout");
  return { ok: siteId ? "保存しました。全ページに concerto の計測タグが入ります" : "保存しました（計測タグは外しました）" };
}

export type TokenState = { error?: string; token?: string; name?: string } | undefined;

export async function createApiToken(_: TokenState, form: FormData): Promise<TokenState> {
  const user = await requireAdmin();
  if (isDemo()) return { error: "デモ環境では接続トークンを発行できません" };
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "用途（例: concerto、sonata）を入力してください" };
  const { token } = issueToken(db, name, user.id);
  revalidatePath(PATH);
  return { token, name };
}

export async function revokeApiToken(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  if (Number.isSafeInteger(id) && id > 0) revokeToken(db, id);
  revalidatePath(PATH);
}
