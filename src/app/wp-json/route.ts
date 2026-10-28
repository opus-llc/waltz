import { getSettings } from "@/lib/settings";
import { wpJson } from "@/lib/integrations/http";

export const dynamic = "force-dynamic";

/** REST API の入口。WordPress と同じく、サイト名と使える名前空間を返す */
export function GET() {
  const s = getSettings();
  return wpJson({
    name: s.siteName,
    description: s.description,
    url: s.siteUrl,
    home: s.siteUrl,
    namespaces: ["wp/v2", "opus/v1"],
    generator: "waltz",
  });
}
