import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "新規登録", robots: { index: false } };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = (await searchParams).next;
  const n = typeof next === "string" ? next : "";
  return (
    <>
      <h1 className="text-xl font-bold">コミュニティに参加する</h1>
      <p className="mt-2 text-sm text-muted">登録は無料です。同じ仕事をしている人と、記事の感想や悩みを話せます。</p>
      <div className="mt-6"><SignupForm next={n} /></div>
      <p className="mt-6 text-center text-sm">
        登録済みの方は <Link href={`/login${n ? `?next=${encodeURIComponent(n)}` : ""}`} className="accent-text font-bold">ログイン</Link>
      </p>
    </>
  );
}
