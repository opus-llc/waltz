"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveArticle, previewMarkdown } from "@/app/actions/admin";
import { withBase } from "@/lib/base-path";

type Initial = {
  id?: number;
  type: "post" | "page";
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  categoryId: number | null;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published";
  publishedAt: string;
  tags: string;
};

async function upload(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(withBase("/api/upload"), { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "アップロードに失敗しました");
  return json.url as string;
}

/** 先頭の --- で囲まれた front matter から title / excerpt を拾う */
function parseMd(text: string): { title?: string; excerpt?: string; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let body = text;
  const meta: Record<string, string> = {};
  if (m) {
    body = text.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
  }
  let title = meta.title;
  if (!title) {
    const h1 = body.match(/^#\s+(.+)\r?\n/);
    if (h1) {
      title = h1[1].trim();
      body = body.slice(h1[0].length);
    }
  }
  return { title, excerpt: meta.description ?? meta.excerpt, body: body.replace(/^\s+/, "") };
}

export function ArticleEditor({
  initial,
  categories,
  partner,
  publicUrl,
}: {
  initial: Initial;
  categories: Array<{ id: number; name: string }>;
  partner: React.ReactNode;
  publicUrl: string | null;
}) {
  const [state, action, saving] = useActionState(saveArticle, undefined);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isPost = initial.type === "post";

  const insertAtCursor = (text: string) => {
    const el = bodyRef.current;
    if (!el) return setBody((b) => `${b}\n${text}`);
    const { selectionStart: s, selectionEnd: e } = el;
    setBody((b) => b.slice(0, s) + text + b.slice(e));
  };

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={initial.type} />
      <div className="min-w-0 space-y-4">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          required
          aria-label="タイトル"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-xl font-bold sm:text-2xl"
        />
        <div className="rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center gap-1 border-b border-line p-2">
            <button type="button" onClick={() => setTab("write")} className={`btn btn-sm ${tab === "write" ? "btn-primary" : "btn-ghost !border-0"}`}>編集</button>
            <button
              type="button"
              onClick={() => {
                setTab("preview");
                start(async () => setPreview(await previewMarkdown(body)));
              }}
              className={`btn btn-sm ${tab === "preview" ? "btn-primary" : "btn-ghost !border-0"}`}
            >
              プレビュー
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <label className="btn btn-ghost btn-sm !border-0 cursor-pointer">
              画像を挿入
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    setMsg("アップロード中…");
                    const url = await upload(f);
                    insertAtCursor(`\n![画像の説明](${url})\n`);
                    setMsg("画像を挿入しました。「画像の説明」を書き換えてください");
                  } catch (err) {
                    setMsg((err as Error).message);
                  }
                }}
              />
            </label>
            <label className="btn btn-ghost btn-sm !border-0 cursor-pointer">
              .md を取り込む
              <input
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const parsed = parseMd(await f.text());
                  if (parsed.title && !title) setTitle(parsed.title);
                  if (parsed.excerpt && !excerpt) setExcerpt(parsed.excerpt);
                  setBody(parsed.body);
                  setMsg(`「${f.name}」を取り込みました`);
                }}
              />
            </label>
          </div>
          {tab === "write" ? (
            <textarea
              ref={bodyRef}
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={24}
              aria-label="本文（Markdown）"
              placeholder={"## 見出し\n\n本文を Markdown で書きます。"}
              className="block w-full resize-y rounded-b-2xl p-4 font-mono text-[15px] leading-7 outline-none"
            />
          ) : (
            <>
              <input type="hidden" name="body" value={body} />
              <div className="prose-ja min-h-[24rem] p-6" dangerouslySetInnerHTML={{ __html: preview || "<p>読み込み中…</p>" }} />
            </>
          )}
        </div>
        {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
        <details className="rounded-2xl border border-line bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold">SEO・抜粋</summary>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="excerpt">抜粋</label>
              <textarea id="excerpt" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className="field" />
              <p className="hint">空欄なら本文の冒頭から自動で作ります</p>
            </div>
            <div>
              <label className="label" htmlFor="seoTitle">SEOタイトル</label>
              <input id="seoTitle" name="seoTitle" defaultValue={initial.seoTitle} className="field" />
              <p className="hint">空欄ならタイトルを使います</p>
            </div>
            <div>
              <label className="label" htmlFor="seoDescription">メタディスクリプション</label>
              <textarea id="seoDescription" name="seoDescription" defaultValue={initial.seoDescription} rows={2} className="field" />
            </div>
          </div>
        </details>
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm">
            状態：<b>{initial.status === "published" ? "公開中" : "下書き"}</b>
            {publicUrl && <Link href={publicUrl} target="_blank" className="accent-text ml-2 text-xs">表示 ↗</Link>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button name="intent" value="save" className="btn btn-ghost btn-sm" disabled={saving}>保存</button>
            {initial.status === "published" ? (
              <button name="intent" value="unpublish" className="btn btn-ghost btn-sm" disabled={saving}>非公開に戻す</button>
            ) : (
              <button name="intent" value="publish" className="btn btn-primary btn-sm" disabled={saving}>公開する</button>
            )}
          </div>
          {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
          {state?.ok && <p className="text-sm text-emerald-700" role="status">{state.ok}</p>}
          <div>
            <label className="label" htmlFor="publishedAt">公開日時（日本時間）</label>
            <input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={initial.publishedAt} className="field" />
            <p className="hint">未来の日時にすると予約公開になります</p>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <div>
            <label className="label" htmlFor="slug">URL</label>
            <div className="flex items-center gap-1 text-sm text-muted">
              /{isPost ? "articles" : "p"}/
              <input id="slug" name="slug" defaultValue={initial.slug} placeholder="monthly-close" className="field !py-1.5" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            </div>
          </div>
          {isPost && (
            <>
              <div>
                <label className="label" htmlFor="categoryId">カテゴリ</label>
                <select id="categoryId" name="categoryId" defaultValue={initial.categoryId ?? ""} className="field">
                  <option value="">なし</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tags">タグ</label>
                <input id="tags" name="tags" defaultValue={initial.tags} placeholder="月次決算, 自動化" className="field" />
                <p className="hint">カンマか読点で区切る</p>
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" name="featured" defaultChecked={initial.featured} className="h-5 w-5" />
                注目記事としてトップに出す
              </label>
            </>
          )}
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="label !mb-0">アイキャッチ画像</p>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBase(coverUrl)} alt="" className="aspect-[1200/630] w-full rounded-lg object-cover" />
          )}
          <input name="coverUrl" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="画像URL（空欄なら自動の表紙）" aria-label="アイキャッチ画像のURL" className="field text-sm" />
          <label className="btn btn-ghost btn-sm w-full cursor-pointer">
            画像をアップロード
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setCoverUrl(await upload(f));
                } catch (err) {
                  setMsg((err as Error).message);
                }
              }}
            />
          </label>
          <div>
            <label className="label" htmlFor="coverAlt">代替テキスト</label>
            <input id="coverAlt" name="coverAlt" defaultValue={initial.coverAlt} className="field text-sm" placeholder="画像の内容を短く" />
          </div>
        </div>
        {partner}
      </aside>
    </form>
  );
}
