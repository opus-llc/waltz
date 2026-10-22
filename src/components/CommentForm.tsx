"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/app/actions/community";

export function CommentForm({ postId }: { postId: number }) {
  const [state, action, pending] = useActionState(addComment, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="comment" className="sr-only">コメント</label>
      <textarea id="comment" name="body" rows={2} required maxLength={1000} placeholder="コメントを書く" className="field" />
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <div className="flex justify-end"><button className="btn btn-primary btn-sm" disabled={pending}>コメントする</button></div>
    </form>
  );
}
