import { XMLParser } from "fast-xml-parser";

/** WordPress 標準エクスポート（WXR）の中身のうち、waltz に移すもの */
export type WxrAuthor = { login: string; email: string; displayName: string };
export type WxrTerm = { slug: string; name: string };
export type WxrComment = {
  id: number;
  author: string;
  date: Date | null;
  content: string;
  approved: boolean;
  type: string;
  parentId: number;
};
export type WxrItem = {
  wpId: number;
  type: string;
  status: string;
  title: string;
  link: string;
  slugRaw: string;
  contentHtml: string;
  excerptHtml: string;
  date: Date | null;
  creator: string;
  parentId: number;
  sticky: boolean;
  attachmentUrl: string;
  categories: WxrTerm[];
  tags: WxrTerm[];
  meta: Record<string, string>;
  comments: WxrComment[];
};
export type WxrData = {
  siteTitle: string;
  siteUrl: string;
  authors: WxrAuthor[];
  categories: WxrTerm[];
  tags: WxrTerm[];
  items: WxrItem[];
};

export class WxrError extends Error {}

/** CDATA の中身を除いた部分に DOCTYPE / ENTITY 宣言があれば拒否する（XXE・実体展開攻撃の入口を断つ） */
function assertNoDoctype(xml: string) {
  const outsideCdata = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(outsideCdata)) throw new WxrError("DOCTYPE や ENTITY 宣言を含む XML は受け付けません");
}

const ARRAY_TAGS = new Set(["item", "wp:author", "wp:category", "wp:tag", "category", "wp:postmeta", "wp:comment"]);

type Node = Record<string, unknown>;

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && "#text" in (v as Node)) return text((v as Node)["#text"]);
  return "";
}
const list = (v: unknown): Node[] => (Array.isArray(v) ? (v as Node[]) : v ? [v as Node] : []);
const int = (v: unknown) => Number.parseInt(text(v), 10) || 0;

/** 残った数値文字参照（&#8217; など）を文字に戻す */
function decodeNumericRefs(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCodePoint(Number.parseInt(h, 16)) ?? m)
    .replace(/&#(\d+);/g, (m, d) => safeCodePoint(Number.parseInt(d, 10)) ?? m);
}
function safeCodePoint(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return null;
  return String.fromCodePoint(n);
}

/** "2024-05-01 03:00:00"（GMT）を Date に。0000-00-00 は null */
function parseGmt(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) || v.startsWith("0000")) return null;
  const d = new Date(`${v.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** GMT が無いとき（下書きなど）はサイトの現地時刻を日本時間とみなす */
function parseLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) || v.startsWith("0000")) return null;
  const d = new Date(`${v.replace(" ", "T")}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseWxr(xml: string): WxrData {
  assertNoDoctype(xml);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
    htmlEntities: false,
    isArray: (name) => ARRAY_TAGS.has(name),
  });
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (e) {
    throw new WxrError(`XML として読めませんでした: ${(e as Error).message}`);
  }
  const channel = (doc.rss as Node | undefined)?.channel as Node | undefined;
  if (!channel || !("wp:wxr_version" in channel)) throw new WxrError("WordPress のエクスポートファイル（WXR）ではありません");

  const t = (v: unknown) => decodeNumericRefs(text(v)).trim();
  const raw = (v: unknown) => text(v);

  const authors = list(channel["wp:author"]).map((a) => ({
    login: t(a["wp:author_login"]),
    email: t(a["wp:author_email"]),
    displayName: t(a["wp:author_display_name"]) || t(a["wp:author_login"]),
  }));
  const categories = list(channel["wp:category"]).map((c) => ({ slug: t(c["wp:category_nicename"]), name: t(c["wp:cat_name"]) }));
  const tags = list(channel["wp:tag"]).map((c) => ({ slug: t(c["wp:tag_slug"]), name: t(c["wp:tag_name"]) }));

  const items: WxrItem[] = list(channel.item).map((it) => {
    const terms = list(it.category).map((c) => ({
      domain: text(c["@_domain"]),
      slug: text(c["@_nicename"]),
      name: t(c),
    }));
    const meta: Record<string, string> = {};
    for (const m of list(it["wp:postmeta"])) meta[t(m["wp:meta_key"])] = raw(m["wp:meta_value"]);
    const dateGmt = parseGmt(t(it["wp:post_date_gmt"]));
    return {
      wpId: int(it["wp:post_id"]),
      type: t(it["wp:post_type"]),
      status: t(it["wp:status"]),
      title: t(it.title),
      link: t(it.link),
      slugRaw: t(it["wp:post_name"]),
      contentHtml: raw(it["content:encoded"]),
      excerptHtml: raw(it["excerpt:encoded"]),
      date: dateGmt ?? parseLocal(t(it["wp:post_date"])),
      creator: t(it["dc:creator"]),
      parentId: int(it["wp:post_parent"]),
      sticky: t(it["wp:is_sticky"]) === "1",
      attachmentUrl: t(it["wp:attachment_url"]),
      categories: terms.filter((c) => c.domain === "category").map(({ slug, name }) => ({ slug, name })),
      tags: terms.filter((c) => c.domain === "post_tag").map(({ slug, name }) => ({ slug, name })),
      meta,
      comments: list(it["wp:comment"]).map((c) => ({
        id: int(c["wp:comment_id"]),
        author: t(c["wp:comment_author"]),
        date: parseGmt(t(c["wp:comment_date_gmt"])) ?? parseLocal(t(c["wp:comment_date"])),
        content: raw(c["wp:comment_content"]),
        approved: t(c["wp:comment_approved"]) === "1",
        type: t(c["wp:comment_type"]),
        parentId: int(c["wp:comment_parent"]),
      })),
    };
  });

  return {
    siteTitle: t(channel.title),
    siteUrl: (t(channel["wp:base_blog_url"]) || t(channel.link)).replace(/\/$/, ""),
    authors,
    categories,
    tags,
    items,
  };
}
