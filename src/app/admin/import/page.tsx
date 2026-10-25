import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { WpImporter } from "@/components/admin/WpImporter";

export default async function AdminImport() {
  // レイアウトの権限確認は RSC の取得で迂回できるため、ページでも必ず確かめる
  await requireAdmin();
  const users = db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role })
    .from(schema.users)
    .where(inArray(schema.users.role, ["admin", "editor"]))
    .orderBy(asc(schema.users.id))
    .all();
  const communities = db
    .select({ id: schema.communities.id, name: schema.communities.name })
    .from(schema.communities)
    .where(eq(schema.communities.archived, false))
    .orderBy(asc(schema.communities.id))
    .all();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WordPress から移行</h1>
        <p className="mt-2 text-sm text-muted">
          WordPress の管理画面「ツール → エクスポート」で書き出した XML ファイルから、投稿・固定ページ・カテゴリ・タグ・画像を取り込みます。
          まず内容を確認し（何も書き込みません）、問題がなければ実行します。旧サイトの URL は新しい URL へ自動で転送されます。
        </p>
      </div>
      {isDemo() ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">デモ環境では WordPress の取り込みは使えません。</p>
      ) : (
        <WpImporter users={users} communities={communities} />
      )}
      <section className="rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-bold">自動では移せないもの</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>ページビルダー（Elementor・Divi など）で作ったレイアウト。文章と画像だけが縦に並びます</li>
          <li>ショートコード（[contact-form-7] など）。本文に文字のまま残るので、記事ごとに直してください</li>
          <li>カスタムフィールド、問い合わせフォームや会員機能などプラグインの機能</li>
          <li>テーマのデザイン、メニュー、ウィジェット</li>
        </ul>
        <p className="mt-2 text-muted">移しきれない部分の手直しや、移行作業そのものの代行は、商用サポート（README）でご相談いただけます。</p>
      </section>
    </div>
  );
}
