import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "") || undefined;
// 前段の中継サーバー（別ドメイン）経由でフォームを送るときに、そのドメインを許可する。例: "waltz.example.com"
const allowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
/**
 * 画面遷移のデータ取得（?_rsc=…）の検査。RSC_PARAM_CHECK=off（ビルド時）で切る。
 * 前段の中継が _rsc を URL から落とす場合（Next.js 14 の rewrites で中継したとき）、Next.js 16 は「値が無い」と
 * 307 で付け直させ、中継がまた落とすので転送が終わらず、リンクもボタンも効かなくなる。
 * この検査は Vary を無視する CDN でのキャッシュ取り違えを防ぐためのもの。前段に CDN が無く、
 * 応答がキャッシュされない（waltz の画面は private, no-store）構成でだけ切る
 */
const validateRSCRequestHeaders = process.env.RSC_PARAM_CHECK !== "off";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // no-referrer にすると Server Actions の送信元確認が落ちるため strict-origin-when-cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  poweredByHeader: false,
  // 末尾スラッシュの除去は src/proxy.ts で行う（旧 WordPress の URL を 1 回の 301 で転送するため）
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb", ...(allowedOrigins.length ? { allowedOrigins } : {}) },
    validateRSCRequestHeaders,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
