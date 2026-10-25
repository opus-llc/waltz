/**
 * WordPress の標準エクスポート（WXR）を取り込む。
 *
 *   npm run import:wordpress -- path/to/export.xml            # ドライラン（何も書き込まない）
 *   npm run import:wordpress -- path/to/export.xml --run      # 取り込みを実行
 *
 * オプション
 *   --on-conflict=skip|rename   同じスラッグの記事があるとき（既定 skip。既存記事は上書きしない）
 *   --assign-to=<メールアドレス>  すべての記事を既存ユーザーに紐付ける（既定: 同じメールのユーザー、いなければ編集者として作成）
 *   --comments=<コミュニティのスラッグ>  承認済みコメントをコミュニティへ移す（既定: 移さない）
 *   --no-images                 画像を取得しない（元サイトの URL のまま）
 *   --draft-if-issues           「要確認」がある記事は下書きで取り込む
 *   --json                      結果を JSON で出す
 */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { openDb, DB_PATH, UPLOAD_DIR } from "../src/db/connect";
import * as s from "../src/db/schema";
import { parseWxr, dryRun, runImport, DEFAULT_OPTIONS, WxrError, type ImportOptions } from "../src/lib/wp-import";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = args.find((a) => !a.startsWith("--"));

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (!file) fail("使い方: npm run import:wordpress -- path/to/export.xml [--run]");
if (!fs.existsSync(file)) fail(`ファイルが見つかりません: ${file}`);

const { db } = openDb();
const admin = db.select().from(s.users).where(eq(s.users.role, "admin")).limit(1).get();
if (!admin) fail("管理者ユーザーがいません。先に管理者を作ってください（README「最初の管理者」）");

let wxr;
try {
  wxr = parseWxr(fs.readFileSync(file, "utf8"));
} catch (e) {
  fail(e instanceof WxrError ? e.message : `読み込みに失敗しました: ${(e as Error).message}`);
}

const onConflict = value("on-conflict") ?? "skip";
if (onConflict !== "skip" && onConflict !== "rename") fail("--on-conflict は skip か rename です");

const opts: ImportOptions = { ...DEFAULT_OPTIONS, onSlugConflict: onConflict, downloadImages: !flag("no-images"), draftIfIssues: flag("draft-if-issues") };

const assignTo = value("assign-to");
if (assignTo) {
  const u = db.select().from(s.users).where(eq(s.users.email, assignTo.toLowerCase())).get();
  if (!u) fail(`ユーザーが見つかりません: ${assignTo}`);
  for (const a of wxr.authors) opts.authorMap[a.login] = u.id;
  for (const it of wxr.items) opts.authorMap[it.creator] = u.id;
}
const communitySlug = value("comments");
if (communitySlug) {
  const c = db.select().from(s.communities).where(eq(s.communities.slug, communitySlug)).get();
  if (!c) fail(`コミュニティが見つかりません: ${communitySlug}`);
  opts.commentsCommunityId = c.id;
}

const report = dryRun(db, wxr, opts);
const json = flag("json");

if (!flag("run")) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }
  const c = report.counts;
  console.log(`サイト: ${report.site.title}（${report.site.url}）  DB: ${DB_PATH}`);
  console.log(`取り込む: 投稿 ${c.posts}件・固定ページ ${c.pages}件（公開 ${c.published}・予約 ${c.future}・下書き ${c.drafts}）`);
  console.log(`画像 ${c.images}枚・旧URLの転送 ${c.redirects}件・新しいカテゴリ ${c.newCategories}・新しいタグ ${c.newTags}・承認済みコメント ${c.comments}件`);
  console.log(`スラッグを変更: ${c.slugChanged}件・同じスラッグあり: ${c.conflicts}件・要確認: ${c.withIssues}件`);
  for (const a of report.authors) console.log(`投稿者 ${a.displayName}（${a.login}）${a.articles}件 → ${a.matchedUser ? `既存ユーザー「${a.matchedUser}」` : "編集者として作成（ログイン不可）"}`);
  if (report.issueSummary.length) {
    console.log("\n要確認:");
    for (const i of report.issueSummary) console.log(`  - ${i.label}: ${i.articles.length}件（${i.articles.slice(0, 3).join("、")}${i.articles.length > 3 ? " ほか" : ""}）`);
  }
  for (const n of report.notImported) console.log(`取り込まない: ${n.label} ${n.count}件`);
  for (const w of report.warnings) console.log(`注意: ${w}`);
  console.log("\nこれはドライランです。取り込むには --run を付けて実行してください。");
  process.exit(0);
}

runImport(db, wxr, opts, { importerId: admin.id, uploadDir: UPLOAD_DIR, onProgress: (m) => !json && console.log(m) })
  .then((r) => {
    if (json) return console.log(JSON.stringify(r, null, 2));
    const c = r.created;
    console.log(`取り込みました: 投稿 ${c.posts}件・固定ページ ${c.pages}件・ユーザー ${c.users}人・カテゴリ ${c.categories}・タグ ${c.tags}・転送 ${c.redirects}件・コメント ${c.comments}件`);
    console.log(`画像: 保存 ${r.images.downloaded}枚・失敗 ${r.images.failed.length}枚`);
    for (const f of r.images.failed) console.log(`  × ${f.url}（${f.reason}）→ 元の URL のまま: ${f.articles.join("、")}`);
    for (const sk of r.skipped) console.log(`  飛ばした: ${sk.title}（${sk.reason}）`);
  })
  .catch((e) => fail(`取り込みに失敗しました（何も書き込まれていません）: ${(e as Error).message}`));
