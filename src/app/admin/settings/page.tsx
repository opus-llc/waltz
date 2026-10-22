import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { updateSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionForm";
import { PartnerCard } from "@/components/admin/PartnerCard";

export default async function AdminSettings() {
  await requireAdmin();
  const s = getSettings();
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
          <div><label className="label" htmlFor="ga4Id">GA4 測定ID</label><input id="ga4Id" name="ga4Id" defaultValue={s.ga4Id} placeholder="G-XXXXXXXXXX" className="field font-mono" /></div>
          <div>
            <label className="label" htmlFor="externalTagUrl">外部計測タグのURL</label>
            <input id="externalTagUrl" name="externalTagUrl" defaultValue={s.externalTagUrl} placeholder="https://example.com/tag.js" className="field font-mono" />
            <p className="hint">script の読み込みURLだけを登録できます。任意のHTMLは貼れません（管理画面が乗っ取られたときの被害を抑えるため）</p>
          </div>
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
