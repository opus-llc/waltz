import { toggleJoin } from "@/app/actions/community";

export function JoinButton({ slug, joined, owner = false }: { slug: string; joined: boolean; owner?: boolean }) {
  if (owner) return <span className="btn btn-ghost btn-sm pointer-events-none">オーナー</span>;
  return (
    <form action={toggleJoin}>
      <input type="hidden" name="slug" value={slug} />
      <button className={`btn btn-sm ${joined ? "btn-ghost" : "btn-primary"}`}>{joined ? "参加中" : "参加する"}</button>
    </form>
  );
}
