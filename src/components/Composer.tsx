"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPost } from "@/app/actions/community";

type Community = { id: number; name: string; icon: string };

export function Composer({
  communities,
  defaultCommunityId,
  articleId,
  placeholder = "仕事のこと、気軽に話しかけてみましょう",
  compact = false,
}: {
  communities: Community[];
  defaultCommunityId?: number;
  articleId?: number;
  placeholder?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(createPost, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      {articleId && <input type="hidden" name="articleId" value={articleId} />}
      <label className="sr-only" htmlFor={`composer-${articleId ?? "home"}`}>投稿内容</label>
      <textarea
        id={`composer-${articleId ?? "home"}`}
        name="body"
        required
        maxLength={2000}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        className="field resize-y"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select name="communityId" defaultValue={defaultCommunityId ?? ""} className="field !w-auto !py-2 text-sm" aria-label="投稿先">
          <option value="">タイムライン全体</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        {!articleId && (
          <select name="kind" className="field !w-auto !py-2 text-sm" aria-label="種類">
            <option value="post">投稿</option>
            <option value="question">質問</option>
          </select>
        )}
        <button className="btn btn-primary btn-sm ml-auto" disabled={pending}>{pending ? "送信中…" : "投稿する"}</button>
      </div>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700" role="status">{state.ok}</p>}
    </form>
  );
}
