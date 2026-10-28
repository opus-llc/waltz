import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/format";
import { listTokens } from "@/lib/integrations/tokens";
import { revokeApiToken, saveConcerto } from "@/app/actions/integrations";
import { ActionForm } from "@/components/admin/ActionForm";
import { TokenIssuer } from "@/components/admin/TokenIssuer";

export default async function AdminIntegrations() {
  await requireAdmin();
  const s = getSettings();
  const demo = isDemo();
  const tokens = listTokens(db);
  const active = tokens.filter((t) => !t.revokedAt);
  const revoked = tokens.filter((t) => t.revokedAt);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">外部連携</h1>
        <p className="mt-1 text-sm text-muted">
          concerto（記事の計測と改善）と sonata（記事の作成）をつなぎます。waltz は WordPress と同じ形の API（/wp-json）を持つので、どちらも「WordPress のサイト」として登録できます。
        </p>
      </div>
      {demo && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">デモ環境では計測タグの保存・トークンの発行・外部からの書き込みは使えません。</p>}

      <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold">concerto の計測タグ</h2>
        <p className="text-sm leading-relaxed text-muted">
          concerto のメディア詳細「計測タグ」のコードを貼ると、全ページに計測タグが入り、どの記事がどれだけ読まれたかが concerto に届きます。
        </p>
        <ActionForm action={saveConcerto}>
          <div>
            <label className="label" htmlFor="concertoSiteId">計測タグのコード（またはサイトID）</label>
            <input id="concertoSiteId" name="concertoSiteId" defaultValue={s.concertoSiteId} placeholder='<script async src="…/tag.js" data-site="…"></script>' className="field font-mono" disabled={demo} />
            <p className="hint">「サイトに直接貼る場合」の1行をそのまま貼れます。中のサイトID（UUID）だけを保存します。空にすると外します</p>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted">concerto のURLを変える（自分で concerto を動かしている場合）</summary>
            <div className="mt-2">
              <label className="label" htmlFor="concertoOrigin">concerto のURL</label>
              <input id="concertoOrigin" name="concertoOrigin" defaultValue={s.concertoOrigin} className="field font-mono" disabled={demo} />
            </div>
          </details>
        </ActionForm>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold">接続トークン</h2>
        <p className="text-sm leading-relaxed text-muted">
          concerto が改善を記事へ反映するとき、sonata が記事を送るときに使います。持っている人は記事を作成・書き換えできるので、接続先ごとに分けて発行し、使わなくなったら失効させてください。
        </p>
        <TokenIssuer disabled={demo} />
        {active.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {active.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t.name}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{t.prefix}…</span>・{formatDate(t.createdAt)}発行・
                    {t.lastUsedAt ? `最終利用 ${formatDateTime(t.lastUsedAt)}` : "まだ使われていません"}
                  </p>
                </div>
                <details className="relative">
                  <summary className="btn btn-ghost btn-sm cursor-pointer list-none text-red-600">失効</summary>
                  <form action={revokeApiToken} className="absolute right-0 z-10 mt-2 w-60 rounded-xl border border-line bg-white p-3 text-sm shadow-lg">
                    <input type="hidden" name="id" value={t.id} />
                    <p>このトークンを使っている接続（{t.name}）は動かなくなります。</p>
                    <button className="btn btn-sm mt-3 w-full bg-red-600 text-white">失効させる</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
        {revoked.length > 0 && (
          <p className="text-xs text-muted">失効済み: {revoked.map((t) => `${t.name}（${t.prefix}…）`).join("、")}</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed">
        <h2 className="font-bold">つなぎ方</h2>
        <div>
          <h3 className="font-bold">concerto</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>concerto の「メディア」でメディアを追加し、サイトURLに <code className="font-mono">{s.siteUrl}</code>、CMS に「WordPress」を選ぶ</li>
            <li>メディアの編集で「接続トークン」に、上で発行したトークンを貼って保存し、「接続をテストする」を押す</li>
            <li>メディア詳細「計測タグ」のコードを、このページの「concerto の計測タグ」に貼って保存する</li>
          </ol>
          <p className="mt-1 text-muted">これで、記事の取り込み・評価・改善提案、承認した改善の記事への反映が動きます。</p>
        </div>
        <div>
          <h3 className="font-bold">sonata</h3>
          <p className="mt-1">
            sonata の投稿先の設定に、サイトURL <code className="font-mono">{s.siteUrl}</code> と、上で発行したトークンを入れます。sonata から送った記事は下書きで届くので、「記事・固定ページ」で確認してから公開します。
          </p>
        </div>
      </section>
    </div>
  );
}
