import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema, UPLOAD_DIR } from "@/db";

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[name]">) {
  const { name } = await ctx.params;
  if (!/^[a-z0-9]+-[a-f0-9]{12}\.(jpg|png|webp|gif)$/.test(name)) return new Response("Not found", { status: 404 });
  const meta = db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.filename, name)).get();
  if (!meta) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, name));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": meta.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
