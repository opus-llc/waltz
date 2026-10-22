import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { getSettings } from "@/lib/settings";
import { isDemo, resetDemoIfStale } from "@/lib/demo";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = getSettings();
  const accent = HEX.test(s.accentColor) ? s.accentColor : "#4f46e5";
  // デモ環境では誰でも管理者になれるため、外部スクリプトは一切読み込まない
  const ga4 = !isDemo() && GA4.test(s.ga4Id) ? s.ga4Id : null;
  const tagUrl = !isDemo() && /^https:\/\/[^\s"'<>]+$/.test(s.externalTagUrl) ? s.externalTagUrl : null;
  return (
    <html lang="ja" style={{ ["--accent" as string]: accent }}>
      <body className="min-h-dvh antialiased">
        {children}
        {ga4 && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4}');`}
            </Script>
          </>
        )}
        {tagUrl && <Script src={tagUrl} strategy="afterInteractive" />}
      </body>
    </html>
  );
}
