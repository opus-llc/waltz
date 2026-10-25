"use client";

import { useState } from "react";
import Link from "next/link";
import { withBase } from "@/lib/base-path";
import type { DryRunReport, ImportOptions, ImportResult } from "@/lib/wp-import";

type UserOption = { id: number; name: string; email: string; role: string };
type CommunityOption = { id: number; name: string };

const STATUS_LABEL = (a: DryRunReport["articles"][number]) => (a.future ? "予約" : a.status === "published" ? "公開" : "下書き");
const ACTION_LABEL = { create: "取り込む", rename: "別スラッグで取り込む", skip: "飛ばす" } as const;

async function send(file: File, mode: "dry-run" | "run", options: ImportOptions) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);
  fd.append("options", JSON.stringify(options));
  const res = await fetch(withBase("/api/admin/import"), { method: "POST", body: fd });
  const json = (await res.json().catch(() => ({}))) as { error?: string; report?: DryRunReport; result?: ImportResult };
  if (!res.ok) throw new Error(json.error ?? `エラーが発生しました（${res.status}）`);
  return json;
}

export function WpImporter({ users, communities }: { users: UserOption[]; communities: CommunityOption[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"" | "dry-run" | "run">("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [opts, setOpts] = useState<ImportOptions>({ onSlugConflict: "skip", authorMap: {}, downloadImages: true, draftIfIssues: false, commentsCommunityId: null });

  const update = (patch: Partial<ImportOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setConfirmed(false);
  };

  async function check(nextOpts = opts) {
    if (!file) return;
    setBusy("dry-run");
    setError("");
    setResult(null);
    try {
      const { report } = await send(file, "dry-run", nextOpts);
      setReport(report!);
      // 解析結果の紐付け（同じメールの既存ユーザーなど）を初期値として持つ
      setOpts((o) => ({ ...o, authorMap: Object.fromEntries(report!.authors.map((a) => [a.login, a.mappedTo])) }));
      setConfirmed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function run() {
    if (!file) return;
    setBusy("run");
    setError("");
    try {
      const { result } = await send(file, "run", opts);
      setResult(result!);
      setReport(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (result) return <ResultView result={result} onReset={() => { setResult(null); setFile(null); }} />;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold">1. XML ファイルを選ぶ</h2>
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setReport(null);
            setError("");
          }}
          className="block w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-full file:border-0 file:bg-soft file:px-4 file:font-bold"
        />
        <p className="hint">50MB まで。これより大きいときは CLI（npm run import:wordpress）を使ってください。</p>
        <button className="btn btn-primary btn-sm" disabled={!file || !!busy} onClick={() => check()}>
          {busy === "dry-run" ? "確認中…" : "内容を確認する（書き込みません）"}
        </button>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      {report && (
        <>
          <Summary report={report} />

          <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-bold">2. 取り込み方を決める</h2>

            <fieldset className="space-y-2">
              <legend className="label">同じスラッグ（URL）の記事が既にあるとき（{report.counts.conflicts}件）</legend>
              <p className="hint">既存の記事は上書きしません。</p>
              {(["skip", "rename"] as const).map((v) => (
                <label key={v} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input type="radio" name="conflict" className="h-5 w-5" checked={opts.onSlugConflict === v} onChange={() => update({ onSlugConflict: v })} />
                  {v === "skip" ? "取り込まずに飛ばす" : "末尾に -2 などを付けた別のスラッグで取り込む"}
                </label>
              ))}
            </fieldset>

            {report.authors.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="label">投稿者</legend>
                <p className="hint">新しく作る編集者は、ランダムなパスワードでログインできない状態で作られます。</p>
                {report.authors.map((a) => (
                  <div key={a.login} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-center">
                    <p className="text-sm">
                      {a.displayName}（{a.login}）<span className="text-muted"> {a.articles}件</span>
                    </p>
                    <select
                      className="field"
                      value={String(opts.authorMap[a.login] ?? a.mappedTo)}
                      onChange={(e) => update({ authorMap: { ...opts.authorMap, [a.login]: e.target.value === "create" ? "create" : Number(e.target.value) } })}
                    >
                      <option value="create">編集者として新しく作る</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>既存ユーザー: {u.name}（{u.email}）</option>
                      ))}
                    </select>
                  </div>
                ))}
              </fieldset>
            )}

            <fieldset className="space-y-1">
              <legend className="label">そのほか</legend>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={opts.downloadImages} onChange={(e) => update({ downloadImages: e.target.checked })} />
                画像を元サイトから取得して、このサイトに保存する（{report.counts.images}枚）
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={opts.draftIfIssues} onChange={(e) => update({ draftIfIssues: e.target.checked })} />
                「要確認」がある記事は下書きで取り込む（{report.counts.withIssues}件）
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={opts.commentsCommunityId != null}
                  disabled={communities.length === 0}
                  onChange={(e) => update({ commentsCommunityId: e.target.checked ? (communities[0]?.id ?? null) : null })}
                />
                承認済みコメント（{report.counts.comments}件）をコミュニティへ移す
              </label>
              {opts.commentsCommunityId != null && (
                <div className="pl-7">
                  <select className="field" value={opts.commentsCommunityId} onChange={(e) => update({ commentsCommunityId: Number(e.target.value) })}>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="hint">記事ごとに「記事を共有した投稿」を作り、コメントをその返信として移します。コメントした人の名前は本文に残し、メールアドレスや IP アドレスは保存しません。</p>
                </div>
              )}
            </fieldset>

            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => check(opts)}>
              {busy === "dry-run" ? "確認中…" : "この設定でもう一度確認する"}
            </button>
          </section>

          <ArticleTable report={report} />

          <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-bold">3. 取り込む</h2>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              上の内容を確認しました（取り込んだ記事は管理画面から1件ずつ削除できます）
            </label>
            <button className="btn btn-primary" disabled={!confirmed || !!busy} onClick={run}>
              {busy === "run" ? "取り込み中…（画像が多いと数分かかります）" : "取り込みを実行する"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function Summary({ report }: { report: DryRunReport }) {
  const c = report.counts;
  const items = [
    { label: "投稿", value: c.posts },
    { label: "固定ページ", value: c.pages },
    { label: "画像", value: c.images },
    { label: "旧URLの転送", value: c.redirects },
  ];
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-bold">確認結果: {report.site.title || "（サイト名なし）"}</h2>
      <p className="text-xs text-muted">{report.site.url}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-soft p-4">
            <p className="text-xs font-bold text-muted">{i.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{i.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">
        公開 {c.published}・予約 {c.future}・下書き {c.drafts} ／ 新しいカテゴリ {c.newCategories}・新しいタグ {c.newTags} ／ 承認済みコメント {c.comments}件 ／ スラッグを付け直す記事 {c.slugChanged}件
      </p>
      {report.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>
      ))}
      {report.issueSummary.length > 0 && (
        <div>
          <h3 className="text-sm font-bold">要確認（自動では移せない箇所）</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {report.issueSummary.map((i) => (
              <li key={i.label}>
                <span className="font-bold">{i.label}</span>
                <span className="text-muted"> — {i.articles.length}件: {i.articles.slice(0, 5).join("、")}{i.articles.length > 5 ? " ほか" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.notImported.length > 0 && (
        <p className="text-sm text-muted">取り込まないもの: {report.notImported.map((n) => `${n.label} ${n.count}件`).join("、")}</p>
      )}
      {report.skippedRedirects.length > 0 && (
        <p className="text-sm text-muted">このサイトの URL と重なるため転送を作らない旧 URL: {report.skippedRedirects.join("、")}</p>
      )}
    </section>
  );
}

function ArticleTable({ report }: { report: DryRunReport }) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-soft text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-3">タイトル・新しい URL</th>
            <th className="px-4 py-3">状態</th>
            <th className="px-4 py-3">扱い</th>
            <th className="px-4 py-3">要確認</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.articles.map((a) => (
            <tr key={a.wpId} className={a.action === "skip" ? "text-muted" : ""}>
              <td className="px-4 py-3">
                <p className="font-bold">{a.title}</p>
                <p className="text-xs text-muted">
                  {a.newPath}
                  {a.slugChanged && <span>（元のスラッグ: {a.originalSlug}）</span>}
                </p>
                {a.oldPaths[0] && <p className="text-xs text-muted">旧: {a.oldPaths[0]}</p>}
              </td>
              <td className="px-4 py-3">{a.type === "page" ? "固定ページ" : "投稿"}・{STATUS_LABEL(a)}</td>
              <td className="px-4 py-3">{ACTION_LABEL[a.action]}</td>
              <td className="px-4 py-3 text-xs">{a.issues.length ? a.issues.map((i) => i.label).join("、") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ResultView({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const c = result.created;
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold">取り込みました</h2>
        <p className="text-sm">
          投稿 {c.posts}件・固定ページ {c.pages}件・ユーザー {c.users}人・カテゴリ {c.categories}・タグ {c.tags}・旧URLの転送 {c.redirects}件
          {c.comments > 0 && `・コメント ${c.comments}件`}
        </p>
        <p className="text-sm">画像: 保存 {result.images.downloaded}枚・取得できなかった画像 {result.images.failed.length}枚</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/articles" className="btn btn-primary btn-sm">記事の一覧へ</Link>
          <button className="btn btn-ghost btn-sm" onClick={onReset}>別のファイルを取り込む</button>
        </div>
      </section>
      {result.images.failed.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">取得できなかった画像</h2>
          <p className="hint">本文では元サイトの URL のままです。元サイトを閉じる前に、記事の編集画面から画像を入れ直してください。</p>
          <ul className="mt-3 space-y-2 text-sm">
            {result.images.failed.map((f) => (
              <li key={f.url} className="break-all">
                <span className="font-mono text-xs">{f.url}</span>
                <span className="text-muted">（{f.reason}）— {f.articles.join("、")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.skipped.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">飛ばした記事</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {result.skipped.map((s) => (
              <li key={s.title}>{s.title}（{s.reason}）</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
