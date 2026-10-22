import { allPublished } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const s = getSettings();
  const items = allPublished("post").slice(0, 30);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(s.siteName)}</title>
<link>${esc(s.siteUrl)}</link>
<description>${esc(s.description)}</description>
<language>ja</language>
<atom:link href="${esc(s.siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (p) => `<item>
<title>${esc(p.title)}</title>
<link>${esc(`${s.siteUrl}/articles/${p.slug}`)}</link>
<guid>${esc(`${s.siteUrl}/articles/${p.slug}`)}</guid>
<pubDate>${p.publishedAt?.toUTCString() ?? ""}</pubDate>
<description>${esc(p.excerpt)}</description>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
