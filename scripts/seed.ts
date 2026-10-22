/**
 * サンプルデータ投入。`npm run setup` から呼ばれる。
 * データが既にあれば何もしない。--force で既存データを消して入れ直す。
 */
import { openDb, DB_PATH } from "../src/db/connect";
import * as s from "../src/db/schema";
import { seedDemo } from "../src/db/seed";

const force = process.argv.includes("--force");
const { db, sqlite } = openDb();

if (db.select().from(s.users).limit(1).all().length && !force) {
  console.log("データが既にあるため、サンプル投入をスキップしました（入れ直す場合は npm run seed -- --force）");
  process.exit(0);
}

seedDemo(db, sqlite);
console.log(`サンプルデータを投入しました（DB: ${DB_PATH}）`);
