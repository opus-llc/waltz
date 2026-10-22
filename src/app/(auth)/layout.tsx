import Link from "next/link";
import { getSettings } from "@/lib/settings";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings();
  return (
    <div className="flex min-h-dvh flex-col items-center bg-soft px-4 py-10">
      <Link href="/" className="flex items-center gap-2 font-serif text-lg font-bold">
        <span className="accent-bg inline-block h-6 w-6 rounded-md" aria-hidden />
        {s.siteName}
      </Link>
      <div className="mt-8 w-full max-w-md rounded-3xl border border-line bg-white p-6 sm:p-8">{children}</div>
    </div>
  );
}
