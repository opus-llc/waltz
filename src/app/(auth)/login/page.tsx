import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";
import { isDemo } from "@/lib/demo";

export const metadata: Metadata = { title: "ログイン", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = (await searchParams).next;
  const n = typeof next === "string" ? next : "";
  return (
    <>
      <h1 className="text-xl font-bold">ログイン</h1>
      <div className="mt-6"><LoginForm next={n} /></div>
      {isDemo() && (
        <div className="mt-6 rounded-xl bg-soft p-4 text-xs leading-relaxed">
          <p className="font-bold">デモ用アカウント（パスワードはすべて waltz-demo）</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>管理者: admin@example.com</li>
            <li>編集者: sakura@example.com</li>
            <li>メンバー: hikari@example.com</li>
          </ul>
          <p className="mt-2 text-muted">データは毎朝4時（日本時間）に初期状態へ戻ります。</p>
        </div>
      )}
      <p className="mt-6 text-center text-sm">
        はじめての方は <Link href={`/signup${n ? `?next=${encodeURIComponent(n)}` : ""}`} className="accent-text font-bold">新規登録</Link>
      </p>
    </>
  );
}
