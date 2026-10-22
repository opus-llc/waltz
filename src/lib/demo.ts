import "server-only";
import { eq } from "drizzle-orm";
import { db, schema, sqlite } from "@/db";
import { seedDemo } from "@/db/seed";

/** 公開デモ環境かどうか（DEMO_MODE=1）。誰でも管理者でログインできる前提で、危険な設定を止める */
export const isDemo = () => process.env.DEMO_MODE === "1";

const KEY = "_demoSeededOn"; // src/lib/demo-boot.ts と同じキー
const jstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const jstHour = () => new Date(Date.now() + 9 * 3600_000).getUTCHours();

/**
 * デモ環境のデータを日本時間の毎朝4時以降、最初のアクセスでサンプルに戻す。
 * 外部のスケジューラや秘密の鍵を使わずに済むよう、アプリの中で判定する。
 */
export function resetDemoIfStale() {
  if (!isDemo()) return;
  const today = jstToday();
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, KEY)).get();
  if (row?.value === today || (row && jstHour() < 4)) return;
  seedDemo(db, sqlite);
  db.insert(schema.settings).values({ key: KEY, value: today }).onConflictDoUpdate({ target: schema.settings.key, set: { value: today } }).run();
}
