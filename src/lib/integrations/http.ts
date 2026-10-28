import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { isDemo } from "@/lib/demo";
import { hit } from "@/lib/rate-limit";
import { verifyToken, type TokenOwner } from "./tokens";
import { ApiError, MAX_CONTENT_CHARS } from "./wp-compat";

/** API の応答は検索結果に出さない */
const BASE_HEADERS = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };

export function wpJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: { ...BASE_HEADERS, ...init.headers } });
}

/** WordPress と同じ形のエラー（{ code, message, data: { status } }）。concerto は code で原因を分ける */
export function wpError(status: number, code: string, message: string) {
  return wpJson({ code, message, data: { status } }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) return wpError(e.status, e.code, e.message);
  console.error("[wp-json]", e);
  return wpError(500, "internal_error", "処理に失敗しました");
}

const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/**
 * X-Opus-Token で認証する（opus connector プラグインと同じヘッダ。Authorization はホスティングの前段で落ちることがある）。
 * 失敗が続く送信元は 10 分止める
 */
export function authenticate(req: Request): TokenOwner {
  if (isDemo()) throw new ApiError(403, "opus_forbidden", "デモ環境では外部からの書き込みは使えません");
  const ip = clientIp(req);
  const owner = verifyToken(db, req.headers.get("x-opus-token"));
  if (!owner) {
    const limit = hit(`api-token:${ip}`, 20, 10 * 60_000);
    if (!limit.ok) throw new ApiError(429, "opus_rate_limited", `しばらく時間をおいてください（${limit.retryAfterSec}秒）`);
    throw new ApiError(401, "opus_forbidden", "invalid token");
  }
  return owner;
}

/** 本文の上限＋余白を超える送信は読まずに断る */
export async function readJson(req: Request): Promise<unknown> {
  const max = MAX_CONTENT_CHARS * 4 + 64 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > max) throw new ApiError(413, "opus_too_large", "送信が大きすぎます");
  const text = await req.text();
  if (text.length > max) throw new ApiError(413, "opus_too_large", "送信が大きすぎます");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "opus_bad_request", "JSON の形式が正しくありません");
  }
}

export const refreshSite = () => revalidatePath("/", "layout");

/** パスの数字を記事 ID として読む。数字以外は WordPress と同じくルートが無い扱い */
export function parseId(raw: string): number {
  if (!/^\d{1,15}$/.test(raw)) throw new ApiError(404, "rest_no_route", "No route was found matching the URL and request method.");
  return Number(raw);
}
