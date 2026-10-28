import { fillUrl, type CtaBlock } from "@/lib/cta";

const isExternal = (href: string) => /^https?:\/\//.test(href);
const ext = (href: string) => (isExternal(href) ? { target: "_blank", rel: "noopener" } : {});

/**
 * 記事の中ほど（inline）と末尾（end）に出す申込などの枠。中身はサイト設定の ctaBlocks。
 * リンクは next/link を使わない（/signup など、waltz の外＝同じドメインの本体サービスへ送るため basePath を付けない）
 */
export function ArticleCta({ block, slug, placement }: { block: CtaBlock; slug: string; placement: "inline" | "end" }) {
  const inline = placement === "inline";
  const title = (inline && block.inlineTitle) || block.title;
  const body = (inline && block.inlineBody) || block.body;
  const href = fillUrl(block.url, slug, placement);
  const subHref = block.subButton ? fillUrl(block.subUrl, slug, placement) : "";
  const [before, after] = block.endText.includes("{link}") ? block.endText.split("{link}", 2) : [block.endText, ""];
  return (
    <aside className={`rounded-2xl border border-line ${inline ? "my-10 bg-soft p-5" : "accent-soft mt-12 p-6 sm:p-8"}`} aria-label={title} data-cta={block.key} data-cta-placement={placement}>
      {block.eyebrow && <p className="accent-text text-xs font-bold tracking-wider">{block.eyebrow}</p>}
      <p className={`headline mt-1 font-bold leading-snug ${inline ? "text-lg" : "font-serif text-xl"}`}>{title}</p>
      {body && <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={href} className="btn btn-primary" {...ext(href)}>{block.button}</a>
        {subHref && <a href={subHref} className="btn btn-ghost" {...ext(subHref)}>{block.subButton}</a>}
      </div>
      {block.note && <p className="mt-3 text-xs text-muted">{block.note}</p>}
      {!inline && block.endText && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {before}
          {block.endLinkLabel && <a href={fillUrl(block.endLinkUrl, slug, placement)} className="accent-text underline" {...ext(block.endLinkUrl)}>{block.endLinkLabel}</a>}
          {after}
        </p>
      )}
    </aside>
  );
}
