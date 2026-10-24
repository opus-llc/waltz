import { withBase } from "@/lib/base-path";

/* アイキャッチ画像。未設定ならカテゴリ名とタイトルから表紙を描く（外部画像に依存しない） */
const PALETTES = [
  ["#0f766e", "#99f6e4"],
  ["#1d4ed8", "#bfdbfe"],
  ["#7c3aed", "#ddd6fe"],
  ["#c2410c", "#fed7aa"],
  ["#be185d", "#fbcfe8"],
  ["#334155", "#cbd5e1"],
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function ArticleCover({
  title,
  coverUrl,
  coverAlt,
  label,
  size = "md",
  className = "",
}: {
  title: string;
  coverUrl?: string | null;
  coverAlt?: string | null;
  label?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={withBase(coverUrl)} alt={coverAlt ?? ""} className={`aspect-[1200/630] w-full object-cover ${className}`} loading="lazy" />;
  }
  const [dark, light] = PALETTES[hash(title) % PALETTES.length];
  const text = size === "lg" ? "text-2xl sm:text-3xl" : size === "md" ? "text-lg" : "text-sm";
  return (
    <div
      role="img"
      aria-label={coverAlt || title}
      className={`relative flex aspect-[1200/630] w-full flex-col justify-end overflow-hidden p-[6%] ${className}`}
      style={{ background: `linear-gradient(135deg, ${dark} 0%, ${dark} 55%, ${light} 140%)` }}
    >
      <span className="absolute -right-[8%] -top-[20%] h-[80%] aspect-square rounded-full opacity-20" style={{ background: light }} />
      <span className="absolute right-[18%] top-[30%] h-[22%] aspect-square rounded-full opacity-25" style={{ background: light }} />
      {label && <span className="relative mb-2 w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white">{label}</span>}
      <span aria-hidden className={`headline relative line-clamp-3 font-serif font-bold leading-snug text-white ${text}`}>{title}</span>
    </div>
  );
}
