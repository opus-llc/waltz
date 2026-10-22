import Link from "next/link";

export function Pagination({ page, total, perPage, basePath, query = {} }: { page: number; total: number; perPage: number; basePath: string; query?: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams({ ...query, ...(p > 1 ? { page: String(p) } : {}) });
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="mt-12 flex items-center justify-center gap-3" aria-label="ページ送り">
      {page > 1 && <Link href={href(page - 1)} className="btn btn-ghost btn-sm">← 前へ</Link>}
      <span className="text-sm text-muted">{page} / {pages}</span>
      {page < pages && <Link href={href(page + 1)} className="btn btn-ghost btn-sm">次へ →</Link>}
    </nav>
  );
}
