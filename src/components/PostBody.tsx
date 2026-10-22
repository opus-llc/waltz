import { splitLinks } from "@/lib/format";

/** 投稿本文はHTMLとして扱わず、URLだけリンクにする */
export function PostBody({ text, clamp = false, plain = false }: { text: string; clamp?: boolean; plain?: boolean }) {
  if (plain) return <p className={`whitespace-pre-wrap break-words leading-relaxed ${clamp ? "line-clamp-4" : ""}`}>{text}</p>;
  return (
    <p className={`whitespace-pre-wrap break-words leading-relaxed ${clamp ? "line-clamp-4" : ""}`}>
      {splitLinks(text).map((p, i) =>
        p.type === "link" ? (
          <a key={i} href={p.value} target="_blank" rel="noopener noreferrer nofollow ugc" className="accent-text break-all underline">
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </p>
  );
}
