"use client";

import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "確認中…" : "ログイン"}</button>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="name">表示名</label>
        <input id="name" name="name" required maxLength={40} autoComplete="name" className="field" placeholder="山田 花子" />
      </div>
      <div>
        <label className="label" htmlFor="handle">ユーザー名</label>
        <div className="flex items-center gap-2">
          <span className="text-muted">@</span>
          <input id="handle" name="handle" required pattern="[a-z0-9_]{3,20}" className="field" placeholder="hanako" autoCapitalize="none" />
        </div>
        <p className="hint">半角英小文字・数字・_ で3〜20文字。プロフィールのURLになります</p>
      </div>
      <div>
        <label className="label" htmlFor="headline">肩書き（任意）</label>
        <input id="headline" name="headline" maxLength={60} className="field" placeholder="経理 @ 株式会社サンプル" />
      </div>
      <div>
        <label className="label" htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className="field" />
        <p className="hint">8文字以上</p>
      </div>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "登録中…" : "登録して参加する"}</button>
    </form>
  );
}
