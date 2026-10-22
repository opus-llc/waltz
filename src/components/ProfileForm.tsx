"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/community";

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#475569"];

export function ProfileForm({ user }: { user: { name: string; headline: string; bio: string; website: string; avatarColor: string } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="name">表示名</label><input id="name" name="name" defaultValue={user.name} required maxLength={40} className="field" /></div>
      <div><label className="label" htmlFor="headline">肩書き</label><input id="headline" name="headline" defaultValue={user.headline} maxLength={60} className="field" placeholder="経理 @ 株式会社サンプル" /></div>
      <div><label className="label" htmlFor="bio">自己紹介</label><textarea id="bio" name="bio" defaultValue={user.bio} maxLength={400} rows={4} className="field" /></div>
      <div><label className="label" htmlFor="website">リンク</label><input id="website" name="website" type="url" defaultValue={user.website} className="field" placeholder="https://" /></div>
      <fieldset>
        <legend className="label">アイコンの色</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="avatarColor" value={c} defaultChecked={c === user.avatarColor} className="peer sr-only" />
              <span className="block h-10 w-10 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-[var(--fg)] peer-focus-visible:ring-2" style={{ background: c }} />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700" role="status">{state.ok}</p>}
      <button className="btn btn-primary" disabled={pending}>保存する</button>
    </form>
  );
}
