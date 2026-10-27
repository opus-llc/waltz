import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/** 自動で移せず、人の確認が要る箇所 */
export type Issue = { kind: "shortcode" | "builder" | "iframe" | "script" | "form" | "media" | "block"; label: string };

export type ConvertContext = {
  /** 元サイトの URL（相対パスの画像・リンクの解決用） */
  siteUrl: string;
  /** 添付ファイル ID → URL・代替テキスト（[gallery ids="..."] の展開用） */
  attachments: Map<number, { url: string; alt: string }>;
  /** 旧 URL（正規化済み）→ 新しいパス。本文中の内部リンクの書き換え用 */
  linkMap: Map<string, string>;
  /** 元のスラッグ（デコード・小文字化済み）→ 新しいパス。パーマリンクの形が違うリンク（/blog/〇〇/ や下書きの記事）の照合用 */
  slugMap: Map<string, string>;
  /** 旧 URL の正規化（legacy-path.ts の normalizeLegacyPath） */
  normalize: (pathname: string, search: string) => string | null;
};

export type ConvertResult = { markdown: string; images: string[]; issues: Issue[] };

/** 中身を変換できるショートコード。これ以外は本文に文字のまま残し「要確認」に出す */
const HANDLED_SHORTCODES = new Set(["caption", "wp_caption", "gallery", "embed"]);

const BUILDER_SHORTCODES: Array<[RegExp, string]> = [
  [/\[vc_(row|column)/, "WPBakery Page Builder"],
  [/\[et_pb_/, "Divi Builder"],
  [/\[fusion_/, "Avada（Fusion Builder）"],
  [/\[cs_(section|row|column)/, "Cornerstone"],
  [/\[themify_builder/, "Themify Builder"],
];
const BUILDER_META: Array<[string, (v: string) => boolean, string]> = [
  ["_elementor_edit_mode", (v) => v === "builder", "Elementor"],
  ["_et_pb_use_builder", (v) => v === "on", "Divi Builder"],
  ["_wpb_vc_js_status", (v) => v === "true", "WPBakery Page Builder"],
  ["_fl_builder_enabled", (v) => v === "1", "Beaver Builder"],
  ["panels_data", (v) => v.length > 0, "SiteOrigin Page Builder"],
  ["_oxygen_builder_shortcodes", (v) => v.length > 0, "Oxygen"],
  ["_bricks_page_content_2", (v) => v.length > 0, "Bricks"],
];
const FORM_SHORTCODES = /^(contact-form-7|contact-form|wpforms|gravityform|formidable|ninja_form|mwform_formkey|mw-wp-form|fluentform|forminator_form)/;

const BLOCK_TAGS = "p|div|h[1-6]|ul|ol|li|dl|dt|dd|blockquote|pre|table|thead|tbody|tr|td|th|figure|figcaption|hr|form|section|article|aside|header|footer|nav|address|iframe|script|style";
const BLOCK_START = new RegExp(`^<(?:${BLOCK_TAGS})[\\s>/]`, "i");

/** WordPress の自動整形（wpautop）の簡易版。クラシックエディタの本文は空行が段落区切り */
export function autop(html: string): string {
  const pres: string[] = [];
  let s = html.replace(/\r\n?/g, "\n").replace(/<pre[\s\S]*?<\/pre>/gi, (m) => `\u0000PRE${pres.push(m) - 1}\u0000`);
  s = s
    .split(/\n\s*\n/)
    .map((chunk) => {
      const c = chunk.trim();
      if (!c) return "";
      if (c.startsWith("\u0000PRE") || BLOCK_START.test(c) || /^\[(?:caption|gallery|embed)\b/.test(c)) return c;
      return `<p>${c.replace(/\n/g, "<br />\n")}</p>`;
    })
    .join("\n\n");
  return s.replace(/\u0000PRE(\d+)\u0000/g, (_, i) => pres[Number(i)]);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s\\]]+))`))?.slice(1).find((v) => v !== undefined) ?? "";

/** 中身を変換できるショートコードを HTML に展開する */
function expandShortcodes(html: string, ctx: ConvertContext): string {
  return html
    .replace(/\[(?:wp_)?caption([^\]]*)\]([\s\S]*?)\[\/(?:wp_)?caption\]/g, (_, _attrs: string, inner: string) => {
      const img = inner.match(/(<a\b[^>]*>\s*)?<img\b[^>]*>(\s*<\/a>)?/i)?.[0] ?? "";
      const caption = inner.replace(img, "").trim();
      return `<figure>${img}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    })
    .replace(/\[gallery([^\]]*)\]/g, (m, attrs: string) => {
      const ids = attr(attrs, "ids").split(",").map((v) => Number(v.trim())).filter(Boolean);
      const imgs = ids.map((id) => ctx.attachments.get(id)).filter((a): a is { url: string; alt: string } => !!a);
      if (!imgs.length) return m;
      return `<p>${imgs.map((a) => `<img src="${esc(a.url)}" alt="${esc(a.alt)}">`).join("\n")}</p>`;
    })
    .replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/g, (_, url: string) => `<p><a href="${esc(url.trim())}">${esc(url.trim())}</a></p>`);
}

function detectIssues(html: string, meta: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (i: Issue) => {
    const key = `${i.kind}:${i.label}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(i);
    }
  };
  for (const [key, test, name] of BUILDER_META) if (meta[key] && test(meta[key])) add({ kind: "builder", label: `ページビルダー（${name}）` });
  for (const [re, name] of BUILDER_SHORTCODES) if (re.test(html)) add({ kind: "builder", label: `ページビルダー（${name}）` });
  const noCode = html.replace(/<(pre|code)\b[\s\S]*?<\/\1>/gi, "");
  for (const m of noCode.matchAll(/\[([a-z][a-z0-9_-]*)(?:\s[^\]]*)?\]/g)) {
    const name = m[1];
    if (HANDLED_SHORTCODES.has(name)) continue;
    // 閉じタグ付きか属性付きか、よく使われる名前だけをショートコードとみなす（本文の「[注]」などを拾わない）
    const looksLike = m[0].includes("=") || noCode.includes(`[/${name}]`) || /[_-]/.test(name) || ["video", "audio", "playlist", "contact", "toc"].includes(name);
    if (!looksLike) continue;
    if (FORM_SHORTCODES.test(name)) add({ kind: "form", label: `フォーム（[${name}]）` });
    else if (name === "video" || name === "audio" || name === "playlist") add({ kind: "media", label: `動画・音声（[${name}]）` });
    else if (!BUILDER_SHORTCODES.some(([re]) => re.test(`[${name}`))) add({ kind: "shortcode", label: `ショートコード [${name}]` });
  }
  if (/<iframe\b/i.test(noCode)) add({ kind: "iframe", label: "埋め込み（iframe）→リンクに置換" });
  if (/<script\b/i.test(noCode)) add({ kind: "script", label: "スクリプト（script）→削除" });
  if (/<form\b/i.test(noCode)) add({ kind: "form", label: "フォーム（form タグ）→削除" });
  if (/<(video|audio)\b/i.test(noCode)) add({ kind: "media", label: "動画・音声（video/audio）→リンクに置換" });
  for (const m of html.matchAll(/<!-- wp:([a-z0-9-]+)\/([a-z0-9-]+)/g)) {
    if (m[1] !== "core") add({ kind: "block", label: `プラグインのブロック（${m[1]}/${m[2]}）` });
  }
  if (/<!-- wp:(columns|group|cover|media-text)\b/.test(html)) add({ kind: "block", label: "レイアウト用ブロック（段組み・カバー等）→本文として縦に並べました" });
  return issues;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i;

function absolute(raw: string, base: string): string | null {
  const v = raw.trim();
  if (!v || v.startsWith("data:") || v.startsWith("#") || v.startsWith("mailto:") || v.startsWith("tel:")) return null;
  try {
    return new URL(v, `${base}/`).toString();
  } catch {
    return null;
  }
}
/** Markdown のリンク先に安全に入るよう、空白と括弧をエンコード */
const mdUrl = (u: string) => u.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

/** URL の最後の部分が取り込む記事のスラッグと一致すれば、その記事のパス（カテゴリ・タグ・画像などの URL は対象外） */
function bySlug(pathname: string, slugMap: Map<string, string>): string | undefined {
  let p = pathname;
  try {
    p = decodeURIComponent(p);
  } catch {}
  p = p.normalize("NFC").toLowerCase();
  if (/^\/(wp-content|wp-admin|category|tag|author|feed|page)\//.test(p)) return undefined;
  const last = p.split("/").filter(Boolean).pop();
  return last ? slugMap.get(last) : undefined;
}

function makeTurndown(ctx: ConvertContext, images: Set<string>): TurndownService {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*", hr: "---" });
  td.use(gfm);
  td.remove(["script", "style", "noscript", "form", "input", "select", "textarea", "button", "object", "embed"]);
  let siteHost = "";
  try {
    siteHost = new URL(ctx.siteUrl).host;
  } catch {
    // サイト URL が無いエクスポートでは内部リンクの書き換えをしない
  }

  const imageMd = (node: HTMLElement) => {
    const src = absolute(node.getAttribute("src") ?? "", ctx.siteUrl);
    if (!src) return "";
    images.add(src);
    const alt = (node.getAttribute("alt") ?? "").replace(/[\[\]\n]/g, " ").trim();
    return `![${alt}](${mdUrl(src)})`;
  };

  // turndown は後から足したルールを先に評価する。汎用のリンクを最初に足し、画像付きリンクなど個別のルールを後から足す
  td.addRule("internalLink", {
    filter: (node) => node.nodeName === "A" && !!(node as HTMLElement).getAttribute("href"),
    replacement: (content, node) => {
      const href = (node as HTMLElement).getAttribute("href") ?? "";
      let out = href;
      const abs = absolute(href, ctx.siteUrl);
      if (abs) {
        const u = new URL(abs);
        out = abs;
        if (siteHost && u.host === siteHost) {
          const mapped = ctx.linkMap.get(ctx.normalize(u.pathname, u.search) ?? "") ?? bySlug(u.pathname, ctx.slugMap);
          if (mapped) out = mapped + u.hash;
        }
      }
      if (!/^(https?:|mailto:|\/)/.test(out)) return content;
      const text = content.trim() || out;
      return `[${text}](${mdUrl(out)})`;
    },
  });
  td.addRule("image", { filter: "img", replacement: (_c, node) => imageMd(node as HTMLElement) });
  // 「メディアファイルへのリンク」付きの画像は、リンクを外して画像だけにする
  td.addRule("linkedImage", {
    filter: (node) => {
      if (node.nodeName !== "A") return false;
      const el = node as HTMLElement;
      const only = Array.from(el.childNodes).filter((n) => !(n.nodeType === 3 && !n.textContent?.trim()));
      return only.length === 1 && only[0].nodeName === "IMG" && IMAGE_EXT.test(el.getAttribute("href") ?? "");
    },
    replacement: (_c, node) => imageMd((node as HTMLElement).querySelector("img") as HTMLElement),
  });
  td.addRule("iframe", {
    filter: ["iframe", "video", "audio"],
    replacement: (_c, node) => {
      const el = node as HTMLElement;
      const src = absolute(el.getAttribute("src") ?? el.querySelector("source")?.getAttribute("src") ?? "", ctx.siteUrl);
      if (!src || !/^https?:/.test(src)) return "";
      let host = src;
      try {
        host = new URL(src).host;
      } catch {}
      const label = el.nodeName === "IFRAME" ? `埋め込み: ${host}` : el.nodeName === "VIDEO" ? "動画" : "音声";
      return `\n\n[${label}](${mdUrl(src)})\n\n`;
    },
  });
  return td;
}

export function convertContent(html: string, meta: Record<string, string>, ctx: ConvertContext): ConvertResult {
  const issues = detectIssues(html, meta);
  const isBlockEditor = html.includes("<!-- wp:");
  let h = expandShortcodes(html, ctx);
  if (!isBlockEditor) h = autop(h);
  const images = new Set<string>();
  const markdown = makeTurndown(ctx, images)
    .turndown(h)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { markdown, images: [...images], issues };
}

/** コメント本文（HTML）を、コミュニティ投稿用のプレーンテキストに */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => {
      const n = Number(d);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    })
    .replace(/&amp;/g, "&")
    .trim();
}
