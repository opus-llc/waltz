"use client";

import { useEffect } from "react";

/**
 * PostHog の初期化。キーが設定されているときだけ、ライブラリを後から読み込む（使わないサイトの表示を重くしない）。
 * 設定は sonata 本体と揃える: 人物のプロフィールはログイン等で identify した人だけ作り、ページ離脱も記録する。
 * ページビューは画面遷移（history）ごとに記録する
 */
export function PostHogInit({ apiKey, apiHost }: { apiKey: string; apiHost: string }) {
  useEffect(() => {
    let cancelled = false;
    import("posthog-js").then(({ default: posthog }) => {
      if (cancelled || posthog.__loaded) return;
      posthog.init(apiKey, {
        api_host: apiHost,
        ...(apiHost.startsWith("/") ? { ui_host: "https://us.posthog.com" } : {}),
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey, apiHost]);
  return null;
}
