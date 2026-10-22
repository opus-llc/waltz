import Link from "next/link";
import { requireAdmin, getCurrentUser } from "@/lib/auth";
import { feed } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { setPostHidden } from "@/app/actions/admin";
import { PostBody } from "@/components/PostBody";

export default async function Moderation() {
  await requireAdmin();
  const viewer = await getCurrentUser();
  const posts = feed({ includeHidden: true, viewerId: viewer?.id, limit: 100 });
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">モデレーション</h1>
      <p className="mt-1 text-sm text-muted">非表示にした投稿はタイムラインから消えます（削除はされません。いつでも戻せます）。</p>
      <ul className="mt-4 space-y-3">
        {posts.map((p) => (
          <li key={p.id} className={`rounded-2xl border bg-white p-4 ${p.hidden ? "border-red-200 bg-red-50/40" : "border-line"}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate"><b>{p.author.name}</b> <span className="text-xs text-muted">{p.community ? `${p.community.icon} ${p.community.name}・` : ""}{timeAgo(p.createdAt)}</span></p>
              <form action={setPostHidden}>
                <input type="hidden" name="postId" value={p.id} />
                <input type="hidden" name="hidden" value={p.hidden ? "0" : "1"} />
                <button className={`btn btn-sm ${p.hidden ? "btn-primary" : "btn-ghost"}`}>{p.hidden ? "表示に戻す" : "非表示にする"}</button>
              </form>
            </div>
            <div className="mt-2 text-sm"><PostBody text={p.body} clamp /></div>
            <Link href={`/community/posts/${p.id}`} className="mt-2 inline-block text-xs text-muted hover:underline">投稿を開く</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
