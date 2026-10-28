import Link from "next/link";
import type { ArticleCard as Card } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { ArticleCover } from "./ArticleCover";
import { articlePath } from "@/lib/paths";

export function ArticleCard({ a, variant = "grid" }: { a: Card; variant?: "grid" | "row" }) {
  if (variant === "row") {
    return (
      <Link href={articlePath(a.slug)} className="group flex gap-4 py-5">
        <div className="w-32 shrink-0 overflow-hidden rounded-lg sm:w-44">
          <ArticleCover title={a.title} coverUrl={a.coverUrl} coverAlt={a.coverAlt} size="sm" />
        </div>
        <div className="min-w-0">
          {a.categoryName && <p className="accent-text text-xs font-bold">{a.categoryName}</p>}
          <h3 className="headline mt-1 line-clamp-2 font-bold leading-snug group-hover:underline sm:text-lg">{a.title}</h3>
          <p className="mt-1 hidden line-clamp-2 text-sm text-muted sm:block">{a.excerpt}</p>
          <p className="mt-2 text-xs text-muted">{formatDate(a.publishedAt)}</p>
        </div>
      </Link>
    );
  }
  return (
    <Link href={articlePath(a.slug)} className="group block">
      <div className="overflow-hidden rounded-xl">
        <ArticleCover title={a.title} coverUrl={a.coverUrl} coverAlt={a.coverAlt} label={a.categoryName} className="transition-transform duration-300 group-hover:scale-[1.02]" />
      </div>
      <h3 className="headline mt-3 line-clamp-2 text-lg font-bold leading-snug group-hover:underline">{a.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{a.excerpt}</p>
      <p className="mt-2 text-xs text-muted">{formatDate(a.publishedAt)}{a.authorName ? `・${a.authorName}` : ""}</p>
    </Link>
  );
}
