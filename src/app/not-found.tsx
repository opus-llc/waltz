import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <p className="accent-text text-sm font-bold">404</p>
      <h1 className="mt-2 text-2xl font-bold">ページが見つかりませんでした</h1>
      <p className="mt-2 text-sm text-muted">URLが変わったか、非公開になった可能性があります。</p>
      <Link href="/" className="btn btn-primary mt-6">トップへ戻る</Link>
    </div>
  );
}
