import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = getSettings();
  if (isDemo()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/community/settings", "/community/notifications"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
