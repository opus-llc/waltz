import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "ログイン", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = (await searchParams).next;
  const n = typeof next === "string" ? next : "";
  return (
    <>
      <h1 className="text-xl font-bold">ログイン</h1>
      <div className="mt-6"><LoginForm next={n} /></div>
      {process.env.NEXT_PUBLIC_DEMO_MODE === "1" && (
        <p className="mt-6 rounded-xl bg-soft p-3 text-xs leading-relaxed text-muted">デモ環境です。ログイン情報は README をご覧ください。</p>
      )}
      <p className="mt-6 text-center text-sm">
        はじめての方は <Link href={`/signup${n ? `?next=${encodeURIComponent(n)}` : ""}`} className="accent-text font-bold">新規登録</Link>
      </p>
    </>
  );
}
