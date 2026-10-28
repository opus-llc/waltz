import "server-only";
import { cache } from "react";
import { db, schema } from "@/db";

export const DEFAULT_SETTINGS = {
  siteName: "waltz",
  tagline: "読む人が、話す人になる。",
  description: "オウンドメディアとコミュニティをひとつに。",
  accentColor: "#4f46e5",
  siteUrl: "http://localhost:3000",
  ga4Id: "",
  externalTagUrl: "",
  /** concerto のメディアのサイトID（計測タグの data-site の UUID）。入れると concerto の計測タグを全ページに入れる */
  concertoSiteId: "",
  concertoOrigin: "https://concerto.sonata-ai.app",
  /** "0" で会員コミュニティを閉じ、記事メディアとして動かす（会員登録は ADMIN_EMAIL だけ） */
  communityEnabled: "1",
  /** ヘッダー右上のボタン（本体サービスへの申込など）。URL が空なら出さない */
  headerCtaLabel: "",
  headerCtaUrl: "",
  /** Google タグマネージャーのコンテナID（GTM-XXXXXXX） */
  gtmId: "",
  /** 記事の中と末尾に出す CTA。JSON の [{ key, title, body, button, url }]。src/lib/cta.ts */
  ctaBlocks: "[]",
  /** PostHog（プロジェクトキーは公開してよい値）。送信先は本体サイトで中継しているなら /ingest など */
  posthogKey: "",
  posthogHost: "https://us.i.posthog.com",
  showPartnerLinks: "1",
  footerNote: "",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const getSettings = cache((): Settings => {
  const rows = db.select().from(schema.settings).all();
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in s) s[r.key as SettingKey] = r.value;
  }
  if (process.env.SITE_URL) s.siteUrl = process.env.SITE_URL;
  s.siteUrl = s.siteUrl.replace(/\/$/, "");
  return s;
});

export const communityOn = (s: Settings) => s.communityEnabled !== "0";

export function saveSettings(values: Partial<Settings>) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    db.insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
      .run();
  }
}
