import { eq } from "drizzle-orm";
import { openDb } from "@/db/connect";
import { seedDemo } from "@/db/seed";
import * as schema from "@/db/schema";

/** デモ環境の起動時に、データが空か古ければサンプルへ戻す（最初のアクセスより前に済ませる） */
export function bootDemo() {
  const { db, sqlite } = openDb();
  try {
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    const row = db.select().from(schema.settings).where(eq(schema.settings.key, "_demoSeededOn")).get();
    if (row?.value === today) return;
    seedDemo(db, sqlite);
    db.insert(schema.settings).values({ key: "_demoSeededOn", value: today }).run();
    console.log(`[waltz] デモデータを初期化しました（${today}）`);
  } finally {
    sqlite.close();
  }
}
