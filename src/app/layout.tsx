import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { getSettings } from "@/lib/settings";
import { isDemo, resetDemoIfStale } from "@/lib/demo";
import { PostHogInit } from "@/components/PostHogInit";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  resetDemoIfStale();
  const s = getSettings();
  return {
    metadataBase: new URL(s.siteUrl),
    title: { default: `${s.siteName}｜${s.tagline}`, template: `%s｜${s.siteName}` },
    description: s.description,
    openGraph: { siteName: s.siteName, type: "website", locale: "ja_JP" },
    alternates: { types: { "application/rss+xml": "/feed.xml" } },
    ...(isDemo() ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const HEX = /^#[0-9a-fA-F]{6}$/;
const GA4 = /^G-[A-Z0-9]{4,20}$/;
const GTM = /^GTM-[A-Z0-9]{4,12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** concerto の配信元。https の origin だけを通す（script の src にそのまま載るため） */
function concertoOrigin(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

function siteHost(siteUrl: string): string | null {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * 計測タグの読み込み。**サイトURL（SITE_URL）のホストで開いたときだけ動かす。**
 * 中継の手前の URL（Cloud Run の直接の URL など）や手元の確認で開いた分を、本番の計測に混ぜないため。
 * concerto のタグは、next/script だと document.currentScript が取れず data-site が読めないので、設定を先にグローバルへ置いてから読み込む
 */
function analyticsLoader(o: { host: string; gtm: string | null; ga4: string | null; tagUrl: string | null; concerto: { site: string; src: string } | null }): string | null {
  const parts: string[] = [];
  if (o.gtm) parts.push(`w.dataLayer=w.dataLayer||[];w.dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});load("https://www.googletagmanager.com/gtm.js?id="+${JSON.stringify(o.gtm)});`);
  if (o.ga4) parts.push(`w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||function(){w.dataLayer.push(arguments)};w.gtag("js",new Date());w.gtag("config",${JSON.stringify(o.ga4)});load("https://www.googletagmanager.com/gtag/js?id="+${JSON.stringify(o.ga4)});`);
  if (o.tagUrl) parts.push(`load(${JSON.stringify(o.tagUrl)});`);
  if (o.concerto) parts.push(`w.concertoSettings={site:${JSON.stringify(o.concerto.site)}};load(${JSON.stringify(o.concerto.src)});`);
  if (!parts.length) return null;
  return `(function(w,d){if(location.hostname!==${JSON.stringify(o.host)})return;function load(src){var j=d.createElement("script");j.async=true;j.src=src;d.head.appendChild(j)}${parts.join("")}})(window,document);`;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = getSettings();
  const accent = HEX.test(s.accentColor) ? s.accentColor : "#4f46e5";
  // デモ環境では誰でも管理者になれるため、外部スクリプトは一切読み込まない
  const ga4 = !isDemo() && GA4.test(s.ga4Id) ? s.ga4Id : null;
  const tagUrl = !isDemo() && /^https:\/\/[^\s"'<>]+$/.test(s.externalTagUrl) ? s.externalTagUrl : null;
  const gtm = !isDemo() && GTM.test(s.gtmId) ? s.gtmId : null;
  const posthog = !isDemo() && /^phc_[A-Za-z0-9]{20,80}$/.test(s.posthogKey) ? s.posthogKey : null;
  const concertoSite = !isDemo() && UUID.test(s.concertoSiteId) ? s.concertoSiteId.toLowerCase() : null;
  const concertoSrc = concertoSite ? concertoOrigin(s.concertoOrigin) : null;
  const host = siteHost(s.siteUrl);
  const loader = host ? analyticsLoader({ host, gtm, ga4, tagUrl, concerto: concertoSite && concertoSrc ? { site: concertoSite, src: `${concertoSrc}/tag.js` } : null }) : null;
  return (
    <html lang="ja" style={{ ["--accent" as string]: accent }}>
      <body className="min-h-dvh antialiased">
        {gtm && (
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="gtm" />
          </noscript>
        )}
        {children}
        {loader && <Script id="analytics" strategy="afterInteractive">{loader}</Script>}
        {posthog && <PostHogInit apiKey={posthog} apiHost={s.posthogHost} host={host} />}
      </body>
    </html>
  );
}
