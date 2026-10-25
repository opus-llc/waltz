/** WordPress（WXR）からの取り込み。管理画面（/admin/import）と CLI（npm run import:wordpress）の共通処理 */
export { parseWxr, WxrError, type WxrData } from "./parse";
export { dryRun, runImport, DEFAULT_OPTIONS, type ImportOptions, type DryRunReport, type ImportResult, type PlanArticle } from "./importer";
export type { Issue } from "./convert";

/** 取り込める XML の上限（管理画面のアップロード） */
export const MAX_WXR_BYTES = 50 * 1024 * 1024;
