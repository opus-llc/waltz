import "server-only";
import { cache } from "react";
import { db, schema } from "@/db";

export const DEFAULT_SETTINGS = {
  siteName: "waltz",
  tagline: "読む人が、話す人になる。",
  description: "オウンドメディアとコミュニティをひとつに。",
  accentColor: "#4f46e5",
  siteUrl: "http://localhost:3000",
  ga4Id: "",
  externalTagUrl: "",
  showPartnerLinks: "1",
  footerNote: "",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const getSettings = cache((): Settings => {
  const rows = db.select().from(schema.settings).all();
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in s) s[r.key as SettingKey] = r.value;
  }
  if (process.env.SITE_URL) s.siteUrl = process.env.SITE_URL;
  s.siteUrl = s.siteUrl.replace(/\/$/, "");
  return s;
});

export function saveSettings(values: Partial<Settings>) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    db.insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
      .run();
  }
}
