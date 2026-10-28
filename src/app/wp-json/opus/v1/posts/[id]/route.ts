import { db } from "@/db";
import { getSettings } from "@/lib/settings";
import { authenticate, handleError, parseId, readJson, refreshSite, wpError, wpJson } from "@/lib/integrations/http";
import { articleUrl, connectorView, getPostForEdit, updatePost } from "@/lib/integrations/wp-compat";

export const dynamic = "force-dynamic";

/** 今の本文と指紋（opus connector プラグインの GET /opus/v1/posts/{id} と同じ）。下書きも読める */
export async function GET(req: Request, ctx: RouteContext<"/wp-json/opus/v1/posts/[id]">) {
  try {
    authenticate(req);
    const post = getPostForEdit(db, parseId((await ctx.params).id));
    if (!post) return wpError(404, "opus_not_found", "post not found");
    return wpJson(connectorView(post));
  } catch (e) {
    return handleError(e);
  }
}

/**
 * 本文の差し替え（opus connector プラグインの POST /opus/v1/posts/{id} と同じ）。
 * expected_hash が今の本文と違えば 409。concerto は content（HTML）だけを送る。
 * sonata の再送用に、タイトル・抜粋・状態なども受け付ける
 */
export async function POST(req: Request, ctx: RouteContext<"/wp-json/opus/v1/posts/[id]">) {
  try {
    authenticate(req);
    const id = parseId((await ctx.params).id);
    const { siteUrl } = getSettings();
    const post = updatePost(db, id, await readJson(req), { siteUrl });
    refreshSite();
    const view = connectorView(post);
    return wpJson({ ok: true, id: view.id, content_hash: view.content_hash, status: view.status, link: articleUrl(siteUrl, post.slug) });
  } catch (e) {
    return handleError(e);
  }
}
