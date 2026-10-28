import { db } from "@/db";
import { getSettings } from "@/lib/settings";
import { handleError, wpJson } from "@/lib/integrations/http";
import { listPublishedPosts, parseListQuery, pickFields, serializePost } from "@/lib/integrations/wp-compat";

export const dynamic = "force-dynamic";

/** 公開記事の一覧（WordPress の GET /wp/v2/posts と同じ形）。認証は要らない（公開ページに出ている内容だけ） */
export function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const { rows, total, totalPages } = listPublishedPosts(db, parseListQuery(params));
    const { siteUrl } = getSettings();
    const fields = params.get("_fields");
    return wpJson(
      rows.map((a) => pickFields(serializePost(a, siteUrl), fields)),
      { headers: { "X-WP-Total": String(total), "X-WP-TotalPages": String(totalPages) } },
    );
  } catch (e) {
    return handleError(e);
  }
}
