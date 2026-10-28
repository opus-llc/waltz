import { wpError } from "@/lib/integrations/http";

/**
 * 用意していないルート。WordPress と同じく 404 + rest_no_route を返す
 * （concerto は rest_no_route を「接続の口が無い」、それ以外の 404 を「記事が無い」と読み分ける）
 */
const noRoute = () => wpError(404, "rest_no_route", "No route was found matching the URL and request method.");
export { noRoute as GET, noRoute as POST, noRoute as PUT, noRoute as PATCH, noRoute as DELETE };
