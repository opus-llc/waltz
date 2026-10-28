import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/AuthForms";
import { communityOn, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "新規登録", robots: { index: false } };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = (await searchParams).next;
  const n = typeof next === "string" ? next : "";
  const community = communityOn(getSettings());
  return (
    <>
      <h1 className="text-xl font-bold">{community ? "コミュニティに参加する" : "管理者の登録"}</h1>
      <p className="mt-2 text-sm text-muted">
        {community ? "登録は無料です。同じ仕事をしている人と、記事の感想や悩みを話せます。" : "このサイトは会員登録を受け付けていません。管理者のメールアドレスだけ登録できます。"}
      </p>
      <div className="mt-6"><SignupForm next={n} /></div>
      <p className="mt-6 text-center text-sm">
        登録済みの方は <Link href={`/login${n ? `?next=${encodeURIComponent(n)}` : ""}`} className="accent-text font-bold">ログイン</Link>
      </p>
    </>
  );
}
