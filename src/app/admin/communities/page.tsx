import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { saveCommunity, setCommunityArchived } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionForm";

function Fields({ c }: { c?: { name: string; slug: string; description: string; icon: string; color: string } }) {
  const id = c?.slug ?? "new";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_80px_80px]">
        <div><label className="label" htmlFor={`cn-${id}`}>名前</label><input id={`cn-${id}`} name="name" defaultValue={c?.name} required className="field" /></div>
        <div><label className="label" htmlFor={`cs-${id}`}>URL</label><input id={`cs-${id}`} name="slug" defaultValue={c?.slug} required placeholder="accounting-room" className="field" /></div>
        <div><label className="label" htmlFor={`ci-${id}`}>絵文字</label><input id={`ci-${id}`} name="icon" defaultValue={c?.icon ?? "💬"} className="field text-center" /></div>
        <div><label className="label" htmlFor={`cc-${id}`}>色</label><input id={`cc-${id}`} name="color" type="color" defaultValue={c?.color ?? "#4f46e5"} className="h-[46px] w-full rounded-lg border border-line" /></div>
      </div>
      <div><label className="label" htmlFor={`cd-${id}`}>説明</label><textarea id={`cd-${id}`} name="description" defaultValue={c?.description} rows={2} className="field" /></div>
    </>
  );
}

export default async function AdminCommunities() {
  await requireAdmin();
  const rows = db
    .select({ c: schema.communities, n: sql<number>`(select count(*) from community_members m where m.community_id = ${schema.communities.id})` })
    .from(schema.communities)
    .orderBy(schema.communities.archived, desc(schema.communities.createdAt))
    .all();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">コミュニティ</h1>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold">新しいコミュニティ</h2>
        <p className="mt-1 text-xs text-muted">作成したあなたがオーナーになります。オーナーはイベントを作成できます。</p>
        <div className="mt-4"><ActionForm action={saveCommunity} submitLabel="作成する"><Fields /></ActionForm></div>
      </section>
      {rows.map(({ c, n }) => (
        <section key={c.id} className={`rounded-2xl border border-line bg-white p-5 ${c.archived ? "opacity-60" : ""}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link href={`/community/c/${c.slug}`} className="font-bold hover:underline">{c.icon} {c.name}</Link>
            <span className="text-xs text-muted">{n}人{c.archived && "・アーカイブ済み"}</span>
          </div>
          <ActionForm action={saveCommunity}>
            <input type="hidden" name="id" value={c.id} />
            <Fields c={c} />
          </ActionForm>
          <form action={setCommunityArchived} className="mt-3 text-right">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="archived" value={c.archived ? "0" : "1"} />
            <button className="text-xs text-muted hover:text-fg">{c.archived ? "アーカイブを解除" : "アーカイブする（非表示・投稿は残る）"}</button>
          </form>
        </section>
      ))}
    </div>
  );
}
