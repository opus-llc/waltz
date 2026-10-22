import "server-only";
import type Database from "better-sqlite3";
import { openDb, type DB } from "./connect";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __waltzDb?: { db: DB; sqlite: Database.Database } };
const conn = globalForDb.__waltzDb ?? (globalForDb.__waltzDb = openDb());

export const db: DB = conn.db;
/** 生の SQLite 接続（デモ初期化のトランザクション用） */
export const sqlite = conn.sqlite;
export { schema };
export { DATA_DIR, UPLOAD_DIR } from "./connect";
