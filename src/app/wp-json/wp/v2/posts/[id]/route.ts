import { db } from "@/db";
import { getSettings } from "@/lib/settings";
import { handleError, parseId, wpError, wpJson } from "@/lib/integrations/http";
import { categoriesFor, getPublishedPost, pickFields, serializePost } from "@/lib/integrations/wp-compat";

export const dynamic = "force-dynamic";

/** 公開記事を1件。下書き・予約中は WordPress と同じく 404（rest_post_invalid_id） */
export async function GET(req: Request, ctx: RouteContext<"/wp-json/wp/v2/posts/[id]">) {
  try {
    const post = getPublishedPost(db, parseId((await ctx.params).id));
    if (!post) return wpError(404, "rest_post_invalid_id", "投稿 ID が無効です。");
    const cat = categoriesFor(db, [post]).get(post.id);
    return wpJson(pickFields(serializePost(post, getSettings().siteUrl, cat), new URL(req.url).searchParams.get("_fields")));
  } catch (e) {
    return handleError(e);
  }
}
