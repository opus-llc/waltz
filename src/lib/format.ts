const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "");
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);

/** SNSの投稿時刻表示（7日以内は「◯分前」、それ以前は日付） */
export function timeAgo(d: Date, now = new Date()): string {
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}日前`;
  return formatDate(d);
}

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `post-${Date.now().toString(36)}`;
}

export const isValidSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;

/** 投稿本文: HTMLは使わず、URLだけリンクにする（React側でテキストとして描画） */
export function splitLinks(text: string): Array<{ type: "text" | "link"; value: string }> {
  const parts: Array<{ type: "text" | "link"; value: string }> = [];
  const re = /https?:\/\/[^\s<>"'）」]+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    parts.push({ type: "link", value: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

/** <input type="datetime-local"> の値を日本時間として解釈する（サーバーのタイムゾーンに左右されないように） */
export function parseJstLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → datetime-local 用の日本時間文字列 */
export function toJstLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const j = new Date(d.getTime() + 9 * 3600_000);
  return j.toISOString().slice(0, 16);
}

/** サーバー側の描画時刻（リクエストごとに描画するページで使う） */
export const nowMs = () => Date.now();
