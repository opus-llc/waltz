import Link from "next/link";

export function Tabs({ tabs, active }: { tabs: Array<{ key: string; label: string; href: string }>; active: string }) {
  return (
    <div role="tablist" className="flex border-b border-line bg-white sm:rounded-t-2xl">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={t.key === active}
          className={`relative flex min-h-[48px] flex-1 items-center justify-center text-sm ${t.key === active ? "font-bold" : "text-muted hover:text-fg"}`}
        >
          {t.label}
          {t.key === active && <span className="accent-bg absolute bottom-0 h-[3px] w-12 rounded-full" />}
        </Link>
      ))}
    </div>
  );
}
