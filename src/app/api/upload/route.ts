import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db, schema, UPLOAD_DIR } from "@/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

const MAX = 5 * 1024 * 1024;

/** 中身の先頭バイトで画像形式を判定する（拡張子や Content-Type は信用しない） */
function sniff(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return { ext: "gif", mime: "image/gif" };
  return null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canEdit(user)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "5MB以下の画像にしてください" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return NextResponse.json({ error: "jpg / png / webp / gif の画像を選んでください" }, { status: 400 });
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${kind.ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buf);
  db.insert(schema.mediaFiles).values({ filename, mime: kind.mime, size: buf.length, uploadedBy: user!.id }).run();
  return NextResponse.json({ url: `/uploads/${filename}` });
}
