import { db } from "@/db";
import { getSettings } from "@/lib/settings";
import { authenticate, handleError, readJson, refreshSite, wpJson } from "@/lib/integrations/http";
import { articleUrl, connectorView, createPost } from "@/lib/integrations/wp-compat";

export const dynamic = "force-dynamic";

/**
 * 記事の新規作成（waltz で足した口。opus connector プラグインには無い）。sonata が書いた記事を直接送る。
 * 既定は下書き。著者はトークンを発行した管理者
 */
export async function POST(req: Request) {
  try {
    const owner = authenticate(req);
    const { siteUrl } = getSettings();
    const post = createPost(db, await readJson(req), { authorId: owner.createdBy, siteUrl });
    refreshSite();
    return wpJson(
      { ok: true, ...connectorView(post), link: articleUrl(siteUrl, post.slug), edit_link: `${siteUrl}/admin/articles/${post.id}` },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
