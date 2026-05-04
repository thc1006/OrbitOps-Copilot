// T1 — i18n bootstrap (closes SPEC-004 §AC-S004-5).
//
// Why: VS-9b.* + VS-10a landed UI strings as hardcoded English; AC-S004-5
// mandates i18n even when only English is shipped. Bootstrap i18next +
// react-i18next here, register en + zh-TW resource bundles, and provide
// `initI18n()` for the app root + tests to call.
//
// Usage:
//   // In main.tsx (sync):
//   import { initI18n } from "./i18n";
//   initI18n();
//
//   // In a component:
//   import { useTranslation } from "react-i18next";
//   const { t } = useTranslation();
//   return <div>{t("anomalies.empty")}</div>;
//
// Drift contract: locales/en.json + locales/zh-TW.json must share the
// same key set (enforced by `i18n.test.tsx`).
import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zhTW from "./locales/zh-TW.json";

let _initialized = false;

export async function initI18n(): Promise<I18n> {
  if (_initialized) {
    return i18next;
  }

  await i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      "zh-TW": { translation: zhTW },
    },
    // Default: pick the locale that matches navigator.language; fall back
    // to en if none of our bundles match. The detection-via-localStorage
    // path is a Sprint-3+ enhancement.
    lng: typeof navigator !== "undefined" && navigator.language?.startsWith("zh")
      ? "zh-TW"
      : "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes; double-escape would mangle output
    },
  });

  _initialized = true;
  return i18next;
}

// Test-only: reset so a fresh init can be exercised in unit tests.
export function _resetI18nForTests(): void {
  _initialized = false;
}

export default i18next;
