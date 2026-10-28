import { getSettings } from "@/lib/settings";
import { authenticate, handleError, wpJson } from "@/lib/integrations/http";
import { CONNECTOR_CAPABILITIES, CONNECTOR_VERSION } from "@/lib/integrations/version";

export const dynamic = "force-dynamic";

/** 接続テスト（opus connector プラグインの GET /opus/v1/ping と同じ）。記事には触らない */
export function GET(req: Request) {
  try {
    authenticate(req);
    return wpJson({ ok: true, version: CONNECTOR_VERSION, site: getSettings().siteUrl, capabilities: CONNECTOR_CAPABILITIES });
  } catch (e) {
    return handleError(e);
  }
}
