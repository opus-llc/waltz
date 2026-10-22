import "server-only";
import { openDb, type DB } from "./connect";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __ensembleDb?: DB };

export const db: DB = globalForDb.__ensembleDb ?? (globalForDb.__ensembleDb = openDb().db);
export { schema };
export { DATA_DIR, UPLOAD_DIR } from "./connect";
