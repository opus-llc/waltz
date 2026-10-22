import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { setRole } from "@/app/actions/admin";
import { Avatar } from "@/components/Avatar";

const ROLES = { admin: "管理者", editor: "編集者", member: "メンバー" } as const;

export default async function AdminMembers() {
  const me = await requireAdmin();
  const users = db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).all();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">メンバー</h1>
      <p className="mt-1 text-sm text-muted">編集者は記事を書けます。管理者はサイト設定とメンバー管理もできます。</p>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
            <Avatar name={u.name} color={u.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <Link href={`/community/u/${u.handle}`} className="font-bold hover:underline">{u.name}</Link>
              <p className="truncate text-xs text-muted">@{u.handle}・{u.email}・{formatDate(u.createdAt)}登録</p>
            </div>
            {u.id === me.id ? (
              <span className="text-xs text-muted">{ROLES[u.role]}（あなた）</span>
            ) : (
              <form action={setRole} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <label htmlFor={`role-${u.id}`} className="sr-only">権限</label>
                <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="field !w-auto !py-1.5 text-sm">
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm">変更</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
