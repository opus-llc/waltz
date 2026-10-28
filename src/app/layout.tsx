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
  return (
    <html lang="ja" style={{ ["--accent" as string]: accent }}>
      <body className="min-h-dvh antialiased">
        {gtm && (
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="gtm" />
          </noscript>
        )}
        {children}
        {gtm && (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
          </Script>
        )}
        {ga4 && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4}');`}
            </Script>
          </>
        )}
        {tagUrl && <Script src={tagUrl} strategy="afterInteractive" />}
        {posthog && <PostHogInit apiKey={posthog} apiHost={s.posthogHost} />}
        {concertoSite && concertoSrc && (
          <>
            {/* next/script で読み込むと document.currentScript が取れず data-site が読めないため、設定を先にグローバルへ置く（concerto の GTM 用と同じ形） */}
            <Script id="concerto-settings" strategy="beforeInteractive">{`window.concertoSettings={site:"${concertoSite}"};`}</Script>
            <Script src={`${concertoSrc}/tag.js`} strategy="afterInteractive" />
          </>
        )}
      </body>
    </html>
  );
}
