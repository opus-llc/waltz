/**
 * concerto・sonata 向けの口（/wp-json）の確認（ネットワークを使わない）。`npm run test:integrations`
 * 一時ディレクトリに DB を作り、トークン・記事の読み書きの中核を直接呼んで確かめる。
 * ルートの配線は、開発サーバーを立てて curl で別途確かめる（README の「外部連携」）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "waltz-integrations-"));
process.env.DATA_DIR = tmp;
const SITE = "https://media.example.com";

async function main() {
  const { openDb } = await import("../src/db/connect");
  const s = await import("../src/db/schema");
  const { issueToken, verifyToken, revokeToken, listTokens } = await import("../src/lib/integrations/tokens");
  const w = await import("../src/lib/integrations/wp-compat");
  const { eq } = await import("drizzle-orm");
  const { db } = openDb();

  let passed = 0;
  const test = async (name: string, fn: () => unknown) => {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  };
  const apiError = (status: number, code: string) => (e: unknown) => e instanceof w.ApiError && e.status === status && e.code === code;

  await test("トークンは英数字64文字で、平文は DB に残らない。失効すると通らない", () => {
    const { id, token } = issueToken(db, "concerto", null);
    assert.match(token, /^[A-Za-z0-9]{64}$/);
    const row = db.select().from(s.apiTokens).where(eq(s.apiTokens.id, id)).get()!;
    assert.notEqual(row.tokenHash, token);
    assert.equal(row.prefix, token.slice(0, 8));
    assert.equal(verifyToken(db, token)?.name, "concerto");
    assert.ok(db.select().from(s.apiTokens).where(eq(s.apiTokens.id, id)).get()!.lastUsedAt);
    assert.equal(verifyToken(db, `${token.slice(0, 63)}x`), null);
    assert.equal(verifyToken(db, ""), null);
    assert.equal(verifyToken(db, `${token} `.repeat(2)), null);
    revokeToken(db, id);
    assert.equal(verifyToken(db, token), null);
    assert.ok(listTokens(db).find((t) => t.id === id)?.revokedAt);
  });

  db.insert(s.categories).values({ slug: "news", name: "お知らせ" }).run();

  await test("sonata からの作成: 既定は下書きで、公開側の一覧・単記事には出ない", () => {
    const a = w.createPost(db, { title: "録音から書いた記事", content: "## 見出し\n\n本文です。", content_format: "markdown", tags: ["取材", "AI"], category: "news" }, { authorId: null, siteUrl: SITE });
    assert.equal(a.status, "draft");
    assert.match(a.slug, /^post-/);
    assert.equal(a.excerpt, "見出し 本文です。");
    assert.ok(a.categoryId);
    assert.equal(db.select().from(s.articleTags).where(eq(s.articleTags.articleId, a.id)).all().length, 2);
    assert.equal(w.getPublishedPost(db, a.id), null);
    assert.equal(w.listPublishedPosts(db, { page: 1, perPage: 10 }).total, 0);
    assert.equal(w.connectorView(a).status, "draft");
  });

  await test("作成の入力検査（タイトル・本文の必須、形式、未来でない future）", () => {
    const opts = { authorId: null, siteUrl: SITE };
    assert.throws(() => w.createPost(db, { content: "x" }, opts), apiError(400, "opus_bad_request"));
    assert.throws(() => w.createPost(db, { title: "x", content: "   " }, opts), apiError(400, "opus_bad_request"));
    assert.throws(() => w.createPost(db, { title: "x", content: "x", content_format: "docx" }, opts), apiError(400, "opus_bad_request"));
    assert.throws(() => w.createPost(db, { title: "x", content: "x", slug: "日本語" }, opts), apiError(400, "opus_bad_request"));
    assert.throws(() => w.createPost(db, { title: "x", content: "x", status: "future", date: "2001-01-01T00:00:00" }, opts), apiError(400, "opus_bad_request"));
    assert.throws(() => w.createPost(db, { title: "x", content: "x", featured_image_url: "javascript:alert(1)" }, opts), apiError(400, "opus_bad_request"));
    assert.throws(() => w.createPost(db, [], opts), apiError(400, "opus_bad_request"));
  });

  await test("HTML で送られた本文は Markdown に戻し、自サイトの絶対URLはサイト内のパスにする。script は捨てる", () => {
    const a = w.createPost(
      db,
      {
        title: "HTMLの記事",
        slug: "html-post",
        status: "publish",
        content: `<h2>手順</h2><p><a href="${SITE}/articles/other">別の記事</a>と<a href="https://other.example/x">外部</a></p><p><img src="${SITE}/uploads/a-0123456789ab.png" alt="図"></p><script>alert(1)</script><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>`,
      },
      { authorId: null, siteUrl: SITE },
    );
    assert.match(a.body, /^## 手順/);
    assert.ok(a.body.includes("[別の記事](/articles/other)"), a.body);
    assert.ok(a.body.includes("[外部](https://other.example/x)"));
    assert.ok(a.body.includes("![図](/uploads/a-0123456789ab.png)"));
    assert.ok(!a.body.includes("alert"));
    assert.ok(a.body.includes("| A |"));
    assert.equal(a.status, "published");
  });

  await test("日本語の太字は、Markdown にすると壊れる箇所だけ HTML のまま残し、表示で太字になる", async () => {
    const { renderMarkdown } = await import("../src/lib/markdown");
    const md = w.htmlToMarkdown("<p><strong>結論：</strong>締めの前に決める。<strong>手順</strong>は3つ。「<em>待ち</em>」を<strong>（重要）</strong>消す。</p>", SITE);
    assert.ok(md.includes("<strong>結論：</strong>締め"), md);
    assert.ok(md.includes("**手順**"), md);
    assert.ok(md.includes("「*待ち*」"), md);
    assert.ok(md.includes("<strong>（重要）</strong>消す"), md);
    const html = renderMarkdown(md).html;
    assert.ok(html.includes("<strong>結論：</strong>締め") && html.includes("<strong>手順</strong>") && html.includes("<strong>（重要）</strong>"), html);
    assert.ok(!html.includes("**"), html);
  });

  await test("同じスラッグは -2 を付けて作る（外部からの作成は重複で失敗させない）", () => {
    const b = w.createPost(db, { title: "重複", slug: "html-post", content: "x", content_format: "markdown" }, { authorId: null, siteUrl: SITE });
    assert.equal(b.slug, "html-post-2");
  });

  await test("公開記事を WordPress と同じ形で返す（リンク・絶対URL・エスケープ・ページ数）", () => {
    for (let i = 0; i < 3; i++)
      w.createPost(db, { title: `記事 <${i}>`, content: `![x](/uploads/b-0123456789ab.png)\n\n本文${i}`, content_format: "markdown", status: "publish", date: `2026-10-0${i + 1}T10:00:00` }, { authorId: null, siteUrl: SITE });
    w.createPost(db, { title: "予約", content: "x", content_format: "markdown", status: "future", date: "2099-01-01T00:00:00" }, { authorId: null, siteUrl: SITE });
    const page1 = w.listPublishedPosts(db, { page: 1, perPage: 2 });
    assert.equal(page1.total, 4); // 公開は html-post と記事3本（html-post-2 は下書き、予約は未来）
    assert.equal(page1.totalPages, 2);
    const p = w.serializePost(page1.rows[0], SITE);
    assert.equal(p.link, `${SITE}/articles/${page1.rows[0].slug}`);
    assert.equal(p.status, "publish");
    assert.match(p.date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/);
    const sample = w.listPublishedPosts(db, { page: 1, perPage: 10, search: "記事 <1>" }).rows[0];
    const sp = w.serializePost(sample, SITE);
    assert.equal(sp.title.rendered, "記事 &lt;1&gt;");
    assert.equal(sp.date, "2026-10-02T10:00:00");
    assert.equal(sp.date_gmt, "2026-10-02T01:00:00");
    assert.ok(sp.content.rendered.includes(`src="${SITE}/uploads/b-0123456789ab.png"`), sp.content.rendered);
    assert.deepEqual(Object.keys(w.pickFields(sp, "id,link,title.rendered")), ["id", "link", "title"]);
    assert.throws(() => w.listPublishedPosts(db, { page: 3, perPage: 2 }), apiError(400, "rest_post_invalid_page_number"));
    // 予約中は出ない
    assert.equal(w.listPublishedPosts(db, { page: 1, perPage: 10, search: "予約" }).total, 0);
  });

  await test("一覧の検索条件は WordPress と同じく範囲外を 400 にし、publish 以外の status を断る", () => {
    const q = (v: string) => w.parseListQuery(new URLSearchParams(v));
    assert.deepEqual(q("status=publish&per_page=50&page=2"), { page: 2, perPage: 50, search: undefined, slug: undefined });
    assert.throws(() => q("per_page=101"), apiError(400, "rest_invalid_param"));
    assert.throws(() => q("page=0"), apiError(400, "rest_invalid_param"));
    assert.throws(() => q("status=draft"), apiError(400, "rest_invalid_param"));
    assert.throws(() => q("status=publish,private"), apiError(400, "rest_invalid_param"));
  });

  await test("記事が1件も無いサイトでも page=1 は空の配列（concerto の接続確認が通る）", () => {
    const r = w.listPublishedPosts(db, { page: 1, perPage: 1, slug: "no-such-slug" });
    assert.equal(r.rows.length, 0);
    assert.equal(r.totalPages, 0);
  });

  await test("改善の書き戻し: 指紋が違えば 409、合えば本文だけ差し替えて新しい指紋を返す", () => {
    const a = db.select().from(s.articles).where(eq(s.articles.slug, "html-post")).get()!;
    const before = w.connectorView(a);
    assert.equal(before.content_hash, w.contentHash(a.body));
    assert.throws(() => w.updatePost(db, a.id, { content: "<p>x</p>" }, { siteUrl: SITE }), apiError(400, "opus_bad_request"));
    assert.throws(() => w.updatePost(db, a.id, { content: "<p>x</p>", expected_hash: "0".repeat(64) }, { siteUrl: SITE }), apiError(409, "opus_conflict"));
    assert.throws(() => w.updatePost(db, 99999, { content: "<p>x</p>", expected_hash: before.content_hash }, { siteUrl: SITE }), apiError(404, "opus_not_found"));
    assert.throws(() => w.updatePost(db, a.id, { content: "<p> </p>", expected_hash: before.content_hash }, { siteUrl: SITE }), apiError(400, "opus_bad_request"));
    const rendered = w.serializePost(a, SITE).content.rendered;
    const revised = rendered.replace("</h2>", "</h2>\n<p>結論を先に書きました。</p>");
    const updated = w.updatePost(db, a.id, { content: revised, expected_hash: before.content_hash }, { siteUrl: SITE });
    assert.ok(updated.body.startsWith("## 手順\n\n結論を先に書きました。"), updated.body);
    assert.ok(updated.body.includes("[別の記事](/articles/other)"), "絶対URLにしたリンクがサイト内のパスに戻る");
    assert.equal(updated.title, a.title);
    assert.equal(updated.status, "published");
    assert.notEqual(w.connectorView(updated).content_hash, before.content_hash);
    // 同じ指紋で2回目は 409（間に誰かが書いた扱い）
    assert.throws(() => w.updatePost(db, a.id, { content: revised, expected_hash: before.content_hash }, { siteUrl: SITE }), apiError(409, "opus_conflict"));
  });

  await test("sonata の再送: 指紋を添えてタイトル・状態も更新できる", () => {
    const a = w.createPost(db, { title: "再送前", content: "初稿", content_format: "markdown" }, { authorId: null, siteUrl: SITE });
    const u = w.updatePost(db, a.id, { title: "再送後", content: "二稿", content_format: "markdown", status: "publish", expected_hash: w.contentHash("初稿") }, { siteUrl: SITE });
    assert.equal(u.title, "再送後");
    assert.equal(u.body, "二稿");
    assert.equal(u.status, "published");
    assert.ok(u.publishedAt);
    assert.equal(w.getPublishedPost(db, a.id)?.id, a.id);
  });

  await test("固定ページは対象外（opus connector と同じく post だけ）", () => {
    const page = db.insert(s.articles).values({ type: "page", slug: "about", title: "会社概要", body: "x", status: "published", publishedAt: new Date() }).returning().get();
    assert.equal(w.getPostForEdit(db, page.id), null);
    assert.equal(w.getPublishedPost(db, page.id), null);
  });

  console.log(`\n${passed} passed`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(tmp, { recursive: true, force: true }));
