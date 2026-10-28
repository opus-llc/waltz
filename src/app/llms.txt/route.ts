import { allPublished, categoriesWithCounts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { articlePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** 生成AI向けのサイト案内（https://llmstxt.org の形式） */
export function GET() {
  const s = getSettings();
  const posts = allPublished("post");
  const pages = allPublished("page");
  const cats = categoriesWithCounts();
  const oneLine = (t: string) => t.replace(/\s+/g, " ").trim();
  const lines = [
    `# ${s.siteName}`,
    "",
    `> ${oneLine(s.description)}`,
    "",
    `${oneLine(s.tagline)}`,
    "",
    "## 記事",
    "",
    ...posts.map((p) => `- [${p.title}](${s.siteUrl}${articlePath(p.slug)})${p.excerpt ? `: ${oneLine(p.excerpt)}` : ""}`),
    "",
    "## カテゴリ",
    "",
    ...cats.map((c) => `- [${c.name}](${s.siteUrl}/categories/${c.slug})${c.description ? `: ${oneLine(c.description)}` : ""}`),
    "",
    "## Optional",
    "",
    ...pages.map((p) => `- [${p.title}](${s.siteUrl}/p/${p.slug})`),
    `- [RSS](${s.siteUrl}/feed.xml)`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
