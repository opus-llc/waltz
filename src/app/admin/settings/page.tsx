import { requireAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { getSettings } from "@/lib/settings";
import { parseCtaBlocks } from "@/lib/cta";
import { updateSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionForm";
import { PartnerCard } from "@/components/admin/PartnerCard";

export default async function AdminSettings() {
  await requireAdmin();
  const s = getSettings();
  const ctas = parseCtaBlocks(s.ctaBlocks);
  const ctaJson = ctas.length ? JSON.stringify(ctas.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v))), null, 2) : "";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">サイト設定</h1>
      <ActionForm action={updateSettings}>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">基本</h2>
          <div><label className="label" htmlFor="siteName">サイト名</label><input id="siteName" name="siteName" defaultValue={s.siteName} required className="field" /></div>
          <div><label className="label" htmlFor="tagline">キャッチコピー</label><input id="tagline" name="tagline" defaultValue={s.tagline} className="field" /></div>
          <div><label className="label" htmlFor="description">説明文</label><textarea id="description" name="description" defaultValue={s.description} rows={3} className="field" /><p className="hint">検索結果・llms.txt・フッターに使われます</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="accentColor">テーマカラー</label><input id="accentColor" name="accentColor" defaultValue={s.accentColor} pattern="#[0-9a-fA-F]{6}" className="field font-mono" /></div>
            <div><label className="label" htmlFor="siteUrl">サイトURL</label><input id="siteUrl" name="siteUrl" defaultValue={s.siteUrl} className="field" /><p className="hint">環境変数 SITE_URL があればそちらが優先</p></div>
          </div>
          <div><label className="label" htmlFor="footerNote">フッターの注記</label><input id="footerNote" name="footerNote" defaultValue={s.footerNote} className="field" /></div>
        </section>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">計測</h2>
          {isDemo() && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">デモ環境では計測タグとサイトURLは保存されません。</p>}
          <div><label className="label" htmlFor="ga4Id">GA4 測定ID</label><input id="ga4Id" name="ga4Id" defaultValue={s.ga4Id} placeholder="G-XXXXXXXXXX" className="field font-mono" /></div>
          <div>
            <label className="label" htmlFor="externalTagUrl">外部計測タグのURL</label>
            <input id="externalTagUrl" name="externalTagUrl" defaultValue={s.externalTagUrl} placeholder="https://example.com/tag.js" className="field font-mono" />
            <p className="hint">script の読み込みURLだけを登録できます。任意のHTMLは貼れません（管理画面が乗っ取られたときの被害を抑えるため）</p>
          </div>
          <div>
            <label className="label" htmlFor="gtmId">Google タグマネージャーのコンテナID</label>
            <input id="gtmId" name="gtmId" defaultValue={s.gtmId} placeholder="GTM-XXXXXXX" className="field font-mono" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="posthogKey">PostHog のプロジェクトキー</label><input id="posthogKey" name="posthogKey" defaultValue={s.posthogKey} placeholder="phc_…" className="field font-mono" /></div>
            <div><label className="label" htmlFor="posthogHost">PostHog の送信先</label><input id="posthogHost" name="posthogHost" defaultValue={s.posthogHost} className="field font-mono" /><p className="hint">本体サイトで中継している場合は /ingest など</p></div>
          </div>
        </section>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">サイトの使い方</h2>
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" name="communityEnabled" defaultChecked={s.communityEnabled !== "0"} className="h-5 w-5" />
            会員コミュニティを使う
          </label>
          <p className="hint">外すと記事メディアとして動きます（コミュニティ・会員登録の画面と導線を隠し、登録できるのは ADMIN_EMAIL の管理者だけ）。</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="headerCtaLabel">ヘッダーのボタンの文言</label><input id="headerCtaLabel" name="headerCtaLabel" defaultValue={s.headerCtaLabel} placeholder="無料で試す" className="field" /></div>
            <div><label className="label" htmlFor="headerCtaUrl">ヘッダーのボタンのリンク先</label><input id="headerCtaUrl" name="headerCtaUrl" defaultValue={s.headerCtaUrl} placeholder="https://" className="field font-mono" /></div>
          </div>
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">記事の CTA</h2>
          <p className="hint">
            記事の中ほど（2つ目の大見出しの前）と末尾に出す申込などの枠です。記事ごとに key で選び、選ばなければ1つ目が出ます。
            項目: key・eyebrow・title・body・inlineTitle・inlineBody（中ほど用。無ければ title・body）・button・url・subButton・subUrl・note・endText（末尾だけ。{"{link}"} の位置に endLinkLabel / endLinkUrl のリンク）。url の {"{slug}"} と {"{placement}"} は記事のスラッグと inline / end に置き換わります。
          </p>
          <label className="label" htmlFor="ctaBlocks">CTA（JSON）</label>
          <textarea id="ctaBlocks" name="ctaBlocks" defaultValue={ctaJson} rows={12} className="field font-mono text-xs" spellCheck={false} />
          {ctas.length > 0 && <p className="hint">登録中: {ctas.map((c) => c.key).join("・")}</p>}
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold">パートナー導線</h2>
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" name="showPartnerLinks" defaultChecked={s.showPartnerLinks === "1"} className="h-5 w-5" />
            管理画面に「困ったときの相談先」を表示する
          </label>
          <p className="hint">記事作成の支援、AI引用診断、カスタマイズ開発の案内です。公開側（読者に見える画面）には出ません。</p>
        </section>
      </ActionForm>
      <PartnerCard kind="measure" />
    </div>
  );
}
