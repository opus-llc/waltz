import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DB } from "../../db/connect";
import * as schema from "../../db/schema";

const { apiTokens } = schema;

/** 英数字だけにする。opus connector プラグイン（WordPress）のトークンと同じ形で、貼り付け先の入力欄を選ばない */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 64;
/** 一覧の「最終利用」を毎リクエスト書かないための間隔 */
const TOUCH_INTERVAL_MS = 60_000;

export const hashToken = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");

function randomToken(): string {
  // 62 で割り切れない端数を捨てて偏りを無くす（248 = 62 * 4）
  let out = "";
  while (out.length < TOKEN_LENGTH) {
    for (const b of crypto.randomBytes(TOKEN_LENGTH)) {
      if (b < 248 && out.length < TOKEN_LENGTH) out += ALPHABET[b % 62];
    }
  }
  return out;
}

/** 発行して平文を返す。平文はここでしか手に入らない */
export function issueToken(db: DB, name: string, createdBy: number | null): { id: number; token: string } {
  const token = randomToken();
  const row = db
    .insert(apiTokens)
    .values({ name: name.trim().slice(0, 60) || "接続トークン", tokenHash: hashToken(token), prefix: token.slice(0, 8), createdBy })
    .returning({ id: apiTokens.id })
    .get();
  return { id: row.id, token };
}

export function listTokens(db: DB) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .orderBy(desc(apiTokens.createdAt), desc(apiTokens.id))
    .all();
}

export function revokeToken(db: DB, id: number) {
  db.update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt))).run();
}

export type TokenOwner = { id: number; name: string; createdBy: number | null };

/**
 * ヘッダの値を照合する。失効済み・未登録は null。
 * 平文どうしは比べず、ハッシュで引く（トークンは 62^64 通りあり、ハッシュの一致を総当たりで作れない）
 */
export function verifyToken(db: DB, given: string | null | undefined): TokenOwner | null {
  const value = (given ?? "").trim();
  if (value.length !== TOKEN_LENGTH || !/^[A-Za-z0-9]+$/.test(value)) return null;
  const row = db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(value)), isNull(apiTokens.revokedAt)))
    .get();
  if (!row) return null;
  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    db.update(apiTokens).set({ lastUsedAt: new Date(now) }).where(eq(apiTokens.id, row.id)).run();
  }
  return { id: row.id, name: row.name, createdBy: row.createdBy };
}
