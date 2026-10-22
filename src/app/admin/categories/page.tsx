import { categoriesWithCounts } from "@/lib/queries";
import { saveCategory, deleteCategory } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionForm";

export default function AdminCategories() {
  const cats = categoriesWithCounts();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">カテゴリ</h1>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold">新しいカテゴリ</h2>
        <ActionForm action={saveCategory} submitLabel="追加する" className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="new-name">名前</label><input id="new-name" name="name" required className="field" /></div>
          <div><label className="label" htmlFor="new-slug">URL（英小文字）</label><input id="new-slug" name="slug" placeholder="accounting" className="field" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="new-desc">説明</label><input id="new-desc" name="description" className="field" /></div>
        </ActionForm>
      </section>
      <ul className="space-y-3">
        {cats.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-white p-5">
            <ActionForm action={saveCategory} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={c.id} />
              <div><label className="label" htmlFor={`n${c.id}`}>名前</label><input id={`n${c.id}`} name="name" defaultValue={c.name} required className="field" /></div>
              <div><label className="label" htmlFor={`s${c.id}`}>URL</label><input id={`s${c.id}`} name="slug" defaultValue={c.slug} required className="field" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor={`d${c.id}`}>説明</label><input id={`d${c.id}`} name="description" defaultValue={c.description} className="field" /></div>
              <p className="text-xs text-muted sm:col-span-2">公開記事 {c.n}本</p>
            </ActionForm>
            <form action={deleteCategory} className="mt-2 text-right">
              <input type="hidden" name="id" value={c.id} />
              <button className="text-xs text-muted hover:text-red-600">このカテゴリを削除（記事は残り、カテゴリなしになります）</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
