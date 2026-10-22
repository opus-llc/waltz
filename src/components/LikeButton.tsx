"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLike } from "@/app/actions/community";

export function LikeButton({ postId, liked, count, loggedIn }: { postId: number; liked: boolean; count: number; loggedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useOptimistic({ liked, count }, (s) => ({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }));
  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? "いいねを取り消す" : "いいね"}
      disabled={pending}
      onClick={() => {
        if (!loggedIn) {
          router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          return;
        }
        start(async () => {
          setState(null);
          await toggleLike(postId);
        });
      }}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm transition ${state.liked ? "text-rose-600" : "text-muted hover:bg-soft"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={state.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" strokeLinejoin="round" />
      </svg>
      {state.count}
    </button>
  );
}
