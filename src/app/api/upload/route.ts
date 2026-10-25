import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db, schema, UPLOAD_DIR } from "@/db";
import { count } from "drizzle-orm";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { MAX_IMAGE_BYTES, newUploadFilename, sniffImage } from "@/lib/image-sniff";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canEdit(user)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  if (isDemo() && (db.select({ n: count() }).from(schema.mediaFiles).get()?.n ?? 0) >= 50)
    return NextResponse.json({ error: "デモ環境のアップロード上限に達しました（毎朝4時に初期化されます）" }, { status: 429 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "5MB以下の画像にしてください" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return NextResponse.json({ error: "jpg / png / webp / gif の画像を選んでください" }, { status: 400 });
  const filename = newUploadFilename(kind.ext, crypto.randomBytes(6).toString("hex"));
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buf);
  db.insert(schema.mediaFiles).values({ filename, mime: kind.mime, size: buf.length, uploadedBy: user!.id }).run();
  return NextResponse.json({ url: `/uploads/${filename}` });
}
