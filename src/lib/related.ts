/** 記事の relatedSlugs / relatedLinks（JSON の文字列）を読む。壊れた値は空として扱う */
export type RelatedLink = { url: string; title: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseRelatedSlugs(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && SLUG.test(x) && x.length <= 80))].slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function parseRelatedLinks(raw: string): RelatedLink[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: RelatedLink[] = [];
    for (const x of v) {
      if (!x || typeof x !== "object") continue;
      const url = typeof x.url === "string" ? x.url.trim() : "";
      const title = typeof x.title === "string" ? x.title.trim().slice(0, 200) : "";
      if (/^https?:\/\/[^\s"'<>]+$/.test(url) && url.length <= 2000 && !out.some((o) => o.url === url)) out.push({ url, title });
    }
    return out.slice(0, 10);
  } catch {
    return [];
  }
}
