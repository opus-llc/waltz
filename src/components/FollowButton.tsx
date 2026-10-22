import { toggleFollow } from "@/app/actions/community";

export function FollowButton({ userId, following }: { userId: number; following: boolean }) {
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="userId" value={userId} />
      <button className={`btn btn-sm ${following ? "btn-ghost" : "btn-primary"}`}>{following ? "フォロー中" : "フォローする"}</button>
    </form>
  );
}
