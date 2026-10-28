import type TurndownService from "turndown";

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/u;

/** 区切り記号（**）の内側が記号で、外側が文字だと、Markdown の規則で太字が閉じない（開かない） */
const breaks = (inner: string | undefined, outer: string | undefined) =>
  !!inner && !!outer && PUNCT.test(inner) && !SPACE.test(outer) && !PUNCT.test(outer);

const lastChar = (s: string | null | undefined) => (s ? [...s].pop() : undefined);
const firstChar = (s: string | null | undefined) => (s ? [...s][0] : undefined);

/**
 * 太字・斜体を Markdown 記法にすると表示が壊れる箇所だけ、HTML タグのまま残す。
 *
 * 例: `<strong>結論：</strong>締めの` → `**結論：**締めの` は、閉じの ** の内側が「：」、外側が「締」のため
 * CommonMark では太字として閉じず、`**` が文字のまま表示される。日本語は単語の間に空白が無いので、
 * 見出し語に「：」「」」「）」を含む太字でほぼ必ず起きる。表示時は marked が HTML のまま通し、sanitize-html の許可リストに入っている
 */
export function keepCjkEmphasis(td: TurndownService) {
  const replacement = (tag: "strong" | "em", mark: string) => (content: string, node: TurndownService.Node) => {
    const text = content.trim();
    if (!text) return "";
    const prev = lastChar(node.previousSibling?.textContent);
    const next = firstChar(node.nextSibling?.textContent);
    if (breaks(firstChar(text), prev) || breaks(lastChar(text), next)) return `<${tag}>${text}</${tag}>`;
    return `${mark}${text}${mark}`;
  };
  td.addRule("cjkStrong", { filter: ["strong", "b"], replacement: replacement("strong", "**") });
  td.addRule("cjkEm", { filter: ["em", "i"], replacement: replacement("em", "*") });
}
