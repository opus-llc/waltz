import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "") || undefined;
// 前段の中継サーバー（別ドメイン）経由でフォームを送るときに、そのドメインを許可する。例: "waltz.example.com"
const allowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

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
