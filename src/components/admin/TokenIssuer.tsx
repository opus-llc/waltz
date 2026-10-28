"use client";

import { useActionState } from "react";
import { createApiToken, type TokenState } from "@/app/actions/integrations";

/** 発行したトークンは、この画面を離れると二度と表示できない（DB にはハッシュしか残らない） */
export function TokenIssuer({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<TokenState, FormData>(createApiToken, undefined);
  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="token-name">用途</label>
          <input id="token-name" name="name" placeholder="例: concerto" maxLength={60} className="field" disabled={disabled} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={pending || disabled}>{pending ? "発行中…" : "トークンを発行"}</button>
      </form>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state?.token && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
          <p className="text-sm font-bold text-emerald-900">「{state.name}」のトークンを発行しました</p>
          <input
            readOnly
            value={state.token}
            aria-label="発行した接続トークン"
            onFocus={(e) => e.currentTarget.select()}
            className="field font-mono text-xs"
          />
          <p className="text-xs leading-relaxed text-emerald-900">
            この画面を離れると、もう表示できません。いまコピーして、接続先（concerto・sonata）の設定に貼り付けてください。なくした場合は、失効させて発行し直します。
          </p>
        </div>
      )}
    </div>
  );
}
