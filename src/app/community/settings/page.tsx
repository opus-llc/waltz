import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "プロフィール設定", robots: { index: false } };

export default async function Settings() {
  const user = await requireUser("/community/settings");
  return (
    <div className="space-y-3">
      <div className="border-line bg-white p-5 sm:rounded-2xl sm:border">
        <h1 className="text-lg font-bold">プロフィール設定</h1>
        <p className="mt-1 text-sm text-muted">@{user.handle}・{user.email}</p>
        <div className="mt-6"><ProfileForm user={user} /></div>
      </div>
      <form action={logout} className="px-4 sm:px-0"><button className="btn btn-ghost btn-sm">ログアウト</button></form>
    </div>
  );
}
