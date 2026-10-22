import { PARTNERS } from "@/lib/partners";
import { getSettings } from "@/lib/settings";

export function PartnerCard({ kind }: { kind: keyof typeof PARTNERS }) {
  if (getSettings().showPartnerLinks !== "1") return null;
  const p = PARTNERS[kind];
  return (
    <div className="rounded-xl border border-dashed border-line bg-soft p-4">
      <p className="text-xs font-bold text-muted">{p.label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{p.description}</p>
      <a href={p.url} target="_blank" rel="noopener" className="accent-text mt-2 inline-block text-sm font-bold">{p.action} ↗</a>
    </div>
  );
}
