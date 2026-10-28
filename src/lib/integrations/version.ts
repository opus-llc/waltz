/** 接続テスト（/opus/v1/ping）で返す版。concerto の画面に出る。口の形を変えたら上げる */
export const CONNECTOR_VERSION = "waltz-1.0.0";

/**
 * opus connector 取り決め v2 の capabilities。concerto はこれを見て、送ってよい項目を決める
 * （無い相手には本文しか送らない）。waltz は記事下の関連記事（related_post_slugs）も持つ
 */
export const CONNECTOR_CAPABILITIES = ["content", "title", "seo_title", "seo_description", "focus_keyword", "related_post_slugs"] as const;
