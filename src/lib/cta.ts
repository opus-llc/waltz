/**
 * 記事の中ほど（inline）と末尾（end）に出す CTA（本体サービスへの申込・資料請求など）。
 * サイト設定の ctaBlocks（JSON の配列）に持つ。記事ごとに key で選び、未指定・未登録の key なら1つ目を出す。1つも無ければ出さない。
 *
 * - inlineTitle / inlineBody があれば中ほどではそちらを使う（読んでいる途中と読み終えた後で、かける言葉を変えられる）
 * - url・subUrl の {slug}（記事のスラッグ）と {placement}（inline / end）は差し込んで出す（どの記事のどこから来たかを UTM で計測する用）
 * - endText は末尾にだけ出す一文。{link} の位置に endLinkLabel / endLinkUrl のリンクが入る
 */
export type CtaBlock = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  inlineTitle: string;
  inlineBody: string;
  button: string;
  url: string;
  subButton: string;
  subUrl: string;
  note: string;
  endText: string;
  endLinkLabel: string;
  endLinkUrl: string;
};

const KEY = /^[a-z0-9_-]{1,30}$/;
const URL_OK = /^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/;

export class CtaError extends Error {}

/** 設定画面から保存するとき用。おかしな値は理由つきで投げる */
export function validateCtaJson(raw: string): CtaBlock[] {
  if (!raw.trim()) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new CtaError("CTA の JSON の形式が正しくありません");
  }
  if (!Array.isArray(list)) throw new CtaError("CTA は配列（[ … ]）で書いてください");
  if (list.length > 10) throw new CtaError("CTA は10個までです");
  const out: CtaBlock[] = [];
  list.forEach((v, i) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new CtaError(`CTA ${i + 1} がオブジェクトではありません`);
    const b = v as Record<string, unknown>;
    const s = (k: string, max: number) => {
      const x = b[k];
      if (x === undefined || x === null) return "";
      if (typeof x !== "string") throw new CtaError(`CTA ${i + 1} の ${k} は文字列にしてください`);
      if (x.length > max) throw new CtaError(`CTA ${i + 1} の ${k} が長すぎます（${max}文字まで）`);
      return x.trim();
    };
    const block: CtaBlock = {
      key: s("key", 30),
      eyebrow: s("eyebrow", 60),
      title: s("title", 120),
      body: s("body", 400),
      inlineTitle: s("inlineTitle", 120),
      inlineBody: s("inlineBody", 400),
      button: s("button", 40),
      url: s("url", 2000),
      subButton: s("subButton", 40),
      subUrl: s("subUrl", 2000),
      note: s("note", 200),
      endText: s("endText", 300),
      endLinkLabel: s("endLinkLabel", 80),
      endLinkUrl: s("endLinkUrl", 2000),
    };
    if (!KEY.test(block.key)) throw new CtaError(`CTA ${i + 1} の key は英小文字・数字・_- で書いてください`);
    if (out.some((o) => o.key === block.key)) throw new CtaError(`CTA の key「${block.key}」が重なっています`);
    if (!block.title || !block.button) throw new CtaError(`CTA ${i + 1} には title と button が要ります`);
    if (!URL_OK.test(block.url)) throw new CtaError(`CTA ${i + 1} の url は https:// か / から書いてください`);
    if (block.subButton && !URL_OK.test(block.subUrl)) throw new CtaError(`CTA ${i + 1} の subUrl は https:// か / から書いてください`);
    if (block.endLinkLabel && !URL_OK.test(block.endLinkUrl)) throw new CtaError(`CTA ${i + 1} の endLinkUrl は https:// か / から書いてください`);
    out.push(block);
  });
  return out;
}

/** 表示用。保存済みの値が壊れていても記事は出す（CTA を出さないだけ） */
export function parseCtaBlocks(raw: string): CtaBlock[] {
  try {
    return validateCtaJson(raw);
  } catch {
    return [];
  }
}

export function pickCta(blocks: CtaBlock[], key: string): CtaBlock | null {
  return blocks.find((b) => b.key === key) ?? blocks[0] ?? null;
}

export const fillUrl = (url: string, slug: string, placement: "inline" | "end") =>
  url.replace(/\{slug\}/g, encodeURIComponent(slug)).replace(/\{placement\}/g, placement);

/** 記事本文の HTML を、2つ目の大見出し（h2）の手前で分ける。中ほどの CTA をそこに差し込む。h2 が2つ未満なら分けない */
export function splitForInlineCta(html: string): [string, string] | null {
  const first = html.indexOf("<h2");
  if (first < 0) return null;
  const second = html.indexOf("<h2", first + 3);
  if (second < 0) return null;
  return [html.slice(0, second), html.slice(second)];
}
