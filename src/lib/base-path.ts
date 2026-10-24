/** サブディレクトリに設置するとき（例: /demo）の接頭辞。ビルド時に NEXT_PUBLIC_BASE_PATH で決まる */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** next/link を使わない URL（<a>・<img>・fetch）にだけ付ける。外部URLはそのまま */
export const withBase = (p: string) => (p.startsWith("/") && !p.startsWith("//") ? `${BASE_PATH}${p}` : p);
