import type { MetadataRoute } from "next";
import { allPublished, categoriesWithCounts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = getSettings();
  const posts = allPublished("post");
  const pages = allPublished("page");
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/articles`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/community`, changeFrequency: "hourly", priority: 0.6 },
    ...categoriesWithCounts().map((c) => ({ url: `${siteUrl}/categories/${c.slug}`, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${siteUrl}/articles/${p.slug}`, lastModified: p.updatedAt, priority: 0.7 })),
    ...pages.map((p) => ({ url: `${siteUrl}/p/${p.slug}`, lastModified: p.updatedAt, priority: 0.3 })),
  ];
}
