import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, UPLOAD_DIR } from "@/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { parseWxr, dryRun, runImport, DEFAULT_OPTIONS, MAX_WXR_BYTES, WxrError, type ImportOptions } from "@/lib/wp-import";

/**
 * WordPress（WXR）の取り込み。mode=dry-run は解析結果だけを返し、mode=run で書き込む。
 * XML は Server Actions の上限（6MB）を超えることが多いため、ルートハンドラで受ける。
 * 管理画面のレイアウトの権限確認は通らないので、ここで必ず管理者かを確かめる。
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "管理者だけが使えます" }, { status: 403 });
  if (isDemo()) return NextResponse.json({ error: "デモ環境では WordPress の取り込みは使えません" }, { status: 403 });
  // 別サイトからの送信を拒否（Cookie は SameSite=Lax だが念のため）。中継サーバー経由は Server Actions と同じ許可リストを使う
  const origin = req.headers.get("origin");
  if (origin && !allowedHosts(req).includes(safeHost(origin)))
    return NextResponse.json({ error: "送信元が正しくありません" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_WXR_BYTES + 1024 * 1024)
    return NextResponse.json({ error: "50MB 以下のファイルにしてください" }, { status: 413 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ファイルを選んでください" }, { status: 400 });
  if (file.size > MAX_WXR_BYTES) return NextResponse.json({ error: "50MB 以下のファイルにしてください" }, { status: 413 });

  let opts: ImportOptions;
  try {
    opts = parseOptions(String(form.get("options") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "設定の形式が正しくありません" }, { status: 400 });
  }

  let wxr;
  try {
    wxr = parseWxr(await file.text());
  } catch (e) {
    return NextResponse.json({ error: e instanceof WxrError ? e.message : "ファイルを読めませんでした" }, { status: 400 });
  }

  if (form.get("mode") !== "run") return NextResponse.json({ report: dryRun(db, wxr, opts) });

  try {
    const result = await runImport(db, wxr, opts, { importerId: user!.id, uploadDir: UPLOAD_DIR });
    revalidatePath("/", "layout");
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[wp-import]", e);
    return NextResponse.json({ error: `取り込みに失敗しました。何も書き込まれていません（${(e as Error).message}）` }, { status: 500 });
  }
}

const safeHost = (origin: string) => {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
};
function allowedHosts(req: Request): string[] {
  const list = [req.headers.get("host"), req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()];
  for (const o of (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",")) list.push(o.trim());
  return list.filter((h): h is string => !!h);
}

function parseOptions(raw: string): ImportOptions {
  const v = JSON.parse(raw) as Partial<Record<keyof ImportOptions, unknown>>;
  const authorMap: ImportOptions["authorMap"] = {};
  if (v.authorMap && typeof v.authorMap === "object") {
    for (const [login, to] of Object.entries(v.authorMap as Record<string, unknown>)) {
      if (to === "create") authorMap[login] = "create";
      else if (Number.isInteger(to)) authorMap[login] = to as number;
    }
  }
  return {
    ...DEFAULT_OPTIONS,
    onSlugConflict: v.onSlugConflict === "rename" ? "rename" : "skip",
    authorMap,
    downloadImages: v.downloadImages !== false,
    draftIfIssues: v.draftIfIssues === true,
    commentsCommunityId: Number.isInteger(v.commentsCommunityId) ? (v.commentsCommunityId as number) : null,
  };
}
