import { eq } from "drizzle-orm";
import type { DB } from "../db/connect";
import * as schema from "../db/schema";
import { slugify } from "./format";

const { articleTags, tags } = schema;

/** 記事のタグを名前の一覧で置き換える。無いタグは作る。10個まで */
export function setArticleTags(db: DB, articleId: number, input: string[]) {
  db.delete(articleTags).where(eq(articleTags.articleId, articleId)).run();
  const names = [...new Set(input.map((t) => t.trim()).filter(Boolean))].slice(0, 10);
  for (const name of names) {
    let tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (!tag) {
      let tslug = slugify(name);
      if (tslug.startsWith("post-")) tslug = `tag-${Buffer.from(name).toString("hex").slice(0, 16)}`;
      if (db.select().from(tags).where(eq(tags.slug, tslug)).get()) tslug = `${tslug}-${Date.now().toString(36)}`;
      tag = db.insert(tags).values({ name, slug: tslug }).returning().get();
    }
    db.insert(articleTags).values({ articleId, tagId: tag.id }).onConflictDoNothing().run();
  }
}

/** 管理画面の入力（読点・カンマ区切り） */
export const splitTagInput = (input: string) => input.split(/[,、，]/);
