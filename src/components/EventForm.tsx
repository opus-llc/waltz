"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEvent } from "@/app/actions/community";

export function EventForm({ communityId }: { communityId: number }) {
  const [state, action, pending] = useActionState(createEvent, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <details className="rounded-2xl border border-line bg-white">
      <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-sm font-bold">＋ イベントを作成</summary>
      <form ref={ref} action={action} className="space-y-3 border-t border-line p-4">
        <input type="hidden" name="communityId" value={communityId} />
        <div><label className="label" htmlFor="ev-title">タイトル</label><input id="ev-title" name="title" required className="field" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ev-start">日時（日本時間）</label><input id="ev-start" name="startsAt" type="datetime-local" required className="field" /></div>
          <div><label className="label" htmlFor="ev-loc">場所</label><input id="ev-loc" name="location" placeholder="オンライン" className="field" /></div>
        </div>
        <div><label className="label" htmlFor="ev-desc">説明</label><textarea id="ev-desc" name="description" rows={3} className="field" /></div>
        <div>
          <label className="label" htmlFor="ev-url">申込URL（任意）</label>
          <input id="ev-url" name="applyUrl" type="url" placeholder="https://" className="field" />
          <p className="hint">外部の申込フォームやイベント管理ツールのURL</p>
        </div>
        {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-sm text-emerald-700" role="status">{state.ok}</p>}
        <button className="btn btn-primary btn-sm" disabled={pending}>公開する</button>
      </form>
    </details>
  );
}
