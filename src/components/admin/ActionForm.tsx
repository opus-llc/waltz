"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

/** サーバー処理の結果（エラー・完了）を表示するだけの汎用フォーム */
export function ActionForm({
  action,
  children,
  submitLabel = "保存する",
  className = "space-y-4",
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700" role="status">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "保存中…" : submitLabel}</button>
    </form>
  );
}
