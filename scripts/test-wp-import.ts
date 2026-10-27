/**
 * WordPress 取り込みの確認（ネットワークを使わない）。`npm run test:wp-import`
 * 一時ディレクトリに DB を作り、test/fixtures/wordpress の XML を取り込んで結果を確かめる。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "waltz-wp-import-"));
process.env.DATA_DIR = tmp;
const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "../test/fixtures/wordpress", name), "utf8");

async function main() {
  const { openDb, UPLOAD_DIR } = await import("../src/db/connect");
  const s = await import("../src/db/schema");
  const { seedDemo } = await import("../src/db/seed");
  const { parseWxr, dryRun, runImport, DEFAULT_OPTIONS, WxrError } = await import("../src/lib/wp-import");
  const { isPublicAddress, checkImageUrl } = await import("../src/lib/wp-import/fetch-image");
  const { normalizeLegacyPath, collidesWithOwnRoute } = await import("../src/lib/legacy-path");
  const { eq } = await import("drizzle-orm");

  let passed = 0;
  const test = async (name: string, fn: () => unknown) => {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  };

  await test("DOCTYPE / ENTITY を含む XML を拒否する（XXE）", () => {
    assert.throws(() => parseWxr(fixture("xxe.xml")), WxrError);
    assert.throws(() => parseWxr("<rss><channel><title>x</title></channel></rss>"), /WXR/);
  });

  await test("内部アドレスへの画像取得を拒否する（SSRF）", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1"])
      assert.equal(isPublicAddress(ip), false, ip);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(ip), true, ip);
    for (const url of ["ftp://example.com/a.jpg", "http://localhost/a.jpg", "http://user:pw@example.com/a.jpg", "http://example.com:8080/a.jpg", "http://[::1]/a.jpg", "http://2130706433/a.jpg", "http://metadata.google.internal/"])
      assert.throws(() => checkImageUrl(url), url);
    assert.doesNotThrow(() => checkImageUrl("https://example.com/a.jpg"));
  });

  await test("旧 URL の正規化（%エンコード・末尾スラッシュ・ID 指定）", () => {
    assert.equal(normalizeLegacyPath("/2024/05/Slug/"), "/2024/05/slug");
    assert.equal(normalizeLegacyPath("/2024/05/%E6%97%A5%E6%9C%AC/"), "/2024/05/日本");
    assert.equal(normalizeLegacyPath("/2024/05/%e6%97%a5%e6%9c%ac"), "/2024/05/日本");
    assert.equal(normalizeLegacyPath("/", "?p=12&utm_source=x"), "/?p=12");
    assert.equal(normalizeLegacyPath("/index.php", "?page_id=3"), "/?page_id=3");
    assert.equal(normalizeLegacyPath("/blog/", "?p=4"), "/blog/?p=4");
    assert.equal(normalizeLegacyPath("/"), null);
    assert.equal(collidesWithOwnRoute("/articles/foo"), true);
    assert.equal(collidesWithOwnRoute("/2024/05/foo"), false);
  });

  const { db, sqlite } = openDb();
  seedDemo(db, sqlite);
  const admin = db.select().from(s.users).where(eq(s.users.role, "admin")).get()!;
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c60000000049454e44ae426082", "hex");
  const fakeFetch = async (url: string) => {
    if (!url.startsWith("https://")) throw new Error("blocked");
    return { buf: png, ext: "png", mime: "image/png" };
  };

  await test("ドライランは何も書き込まない", () => {
    const before = db.select().from(s.articles).all().length;
    const r = dryRun(db, parseWxr(fixture("classic.xml")), DEFAULT_OPTIONS);
    assert.equal(r.counts.posts, 6);
    assert.equal(r.counts.pages, 1);
    assert.ok(r.issueSummary.some((i) => i.label.includes("contact-form-7")));
    assert.ok(r.issueSummary.some((i) => i.kind === "script"));
    assert.equal(db.select().from(s.articles).all().length, before);
  });

  await test("取り込み（本文の変換・画像の書き換え・転送表）", async () => {
    const res = await runImport(db, parseWxr(fixture("classic.xml")), DEFAULT_OPTIONS, { importerId: admin.id, uploadDir: UPLOAD_DIR, fetcher: fakeFetch });
    assert.equal(res.created.posts, 6);
    assert.equal(res.images.failed.length, 0);
    const a = db.select().from(s.articles).where(eq(s.articles.slug, "dont-panic")).get()!;
    assert.equal(a.title, "Don’t Panic & Migrate");
    assert.equal(a.featured, true);
    assert.match(a.coverUrl, /^\/uploads\/[a-z0-9]+-[a-f0-9]{12}\.png$/);
    assert.match(a.body, /\[次の記事\]\(\/articles\/second-post\)/);
    // パーマリンクの形が違う（/blog/〇〇/）下書き記事へのリンクも、スラッグで照合して書き換える
    const second = db.select().from(s.articles).where(eq(s.articles.slug, "second-post")).get()!;
    assert.match(second.body, /\[こちら\]\(\/articles\/review-pending\)/);
    assert.doesNotMatch(a.body, /alert\("xss"\)/);
    assert.match(a.body, /\[埋め込み: www\.youtube\.com\]/);
    assert.doesNotMatch(a.body, /gstatic\.com/);
    const r = db.select().from(s.redirects).where(eq(s.redirects.fromPath, "/2024/05/dont-panic")).get();
    assert.equal(r?.toPath, "/articles/dont-panic");
    const future = db.select().from(s.articles).where(eq(s.articles.slug, "future-post")).get()!;
    assert.equal(future.status, "published");
    assert.ok(future.publishedAt! > new Date());
  });

  await test("同じスラッグは上書きせず、飛ばすか別スラッグにする", async () => {
    const wxr = parseWxr(fixture("classic.xml"));
    const skip = dryRun(db, wxr, DEFAULT_OPTIONS);
    assert.ok(skip.articles.every((x) => x.action === "skip"));
    const rename = dryRun(db, wxr, { ...DEFAULT_OPTIONS, onSlugConflict: "rename" });
    assert.equal(rename.articles.find((x) => x.wpId === 101)?.slug, "dont-panic-2");
  });

  await test("日本語スラッグは英数字のスラッグに付け替え、旧 URL を転送する", async () => {
    await runImport(db, parseWxr(fixture("japanese.xml")), { ...DEFAULT_OPTIONS, onSlugConflict: "rename" }, { importerId: admin.id, uploadDir: UPLOAD_DIR, fetcher: fakeFetch });
    const r = db.select().from(s.redirects).where(eq(s.redirects.fromPath, "/blog/2024/05/日本語の記事")).get();
    assert.equal(r?.toPath, "/articles/post-401");
    assert.equal(db.select().from(s.redirects).where(eq(s.redirects.fromPath, "/blog/?p=402")).get()?.toPath, "/articles/2024-402");
    assert.ok(db.select().from(s.articles).where(eq(s.articles.slug, "about-2")).get());
  });

  await test("書き込みに失敗したら全体を取り消し、保存した画像も消す", async () => {
    const articles = db.select().from(s.articles).all().length;
    const files = fs.readdirSync(UPLOAD_DIR).length;
    // 存在しない管理者 ID → 画像の登録で外部キー違反
    await assert.rejects(runImport(db, parseWxr(fixture("gutenberg.xml")), DEFAULT_OPTIONS, { importerId: 999999, uploadDir: UPLOAD_DIR, fetcher: fakeFetch }));
    assert.equal(db.select().from(s.articles).all().length, articles);
    assert.equal(fs.readdirSync(UPLOAD_DIR).length, files);
  });

  console.log(`\n${passed} 件すべて成功（一時 DB: ${tmp}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(tmp, { recursive: true, force: true }));
