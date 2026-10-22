const SIZES = { xs: "h-6 w-6 text-[11px]", sm: "h-9 w-9 text-sm", md: "h-11 w-11 text-base", lg: "h-20 w-20 text-3xl" };

export function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: keyof typeof SIZES }) {
  const initial = Array.from(name.replace(/\s/g, ""))[0] ?? "?";
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#64748b";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZES[size]}`}
      style={{ backgroundColor: safe }}
    >
      {initial}
    </span>
  );
}
