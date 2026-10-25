import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export const DATA_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATA_DIR ?? "data");
export const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "waltz.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export type DB = BetterSQLite3Database<typeof schema>;

export function openDb(): { db: DB; sqlite: Database.Database } {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("busy_timeout = 5000");
  enableWal(sqlite);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(sqlite, path.join(/* turbopackIgnore: true */ process.cwd(), "drizzle"));
  return { db, sqlite };
}

/**
 * 新しい DB を複数プロセスが同時に WAL へ切り替えると、busy_timeout を待たずに SQLITE_BUSY が返ることがある。
 * 少し待って再試行する（最大で約 5 秒）。
 */
function enableWal(sqlite: Database.Database) {
  for (let attempt = 0; ; attempt++) {
    try {
      sqlite.pragma("journal_mode = WAL");
      return;
    } catch (e) {
      if ((e as { code?: string }).code !== "SQLITE_BUSY" || attempt >= 50) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

/**
 * drizzle の migrate と同じ管理表（__drizzle_migrations）を使って未適用の migration を流す。
 * drizzle の migrate は適用済みかどうかをトランザクションの外で読むため、
 * next build の並列ワーカーのように複数プロセスが同時に開くと、両方が「未適用」と判断して
 * CREATE TABLE が二重に走る。ここでは書き込みロック（BEGIN IMMEDIATE）を取ってから読み直す。
 */
function migrate(sqlite: Database.Database, migrationsFolder: string) {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    );
    const last = sqlite
      .prepare(`SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`)
      .get() as { created_at: number | string } | undefined;
    const insert = sqlite.prepare(`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)`);
    for (const migration of migrations) {
      if (last && Number(last.created_at) >= migration.folderMillis) continue;
      for (const stmt of migration.sql) sqlite.exec(stmt);
      insert.run(migration.hash, migration.folderMillis);
    }
    sqlite.exec("COMMIT");
  } catch (e) {
    sqlite.exec("ROLLBACK");
    throw e;
  }
}
