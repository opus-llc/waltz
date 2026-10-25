/** 画像アップロードの共通ルール。管理画面のアップロードと WordPress 取り込みで同じ検査を使う */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 中身の先頭バイトで画像形式を判定する（拡張子や Content-Type は信用しない） */
export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return { ext: "gif", mime: "image/gif" };
  return null;
}

/** src/app/uploads/[name]/route.ts が受け付ける形式のファイル名 */
export const newUploadFilename = (ext: string, randomHex: string) => `${Date.now().toString(36)}-${randomHex}.${ext}`;
