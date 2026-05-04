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

/**
 * Pick the runtime locale from `navigator.language`. zh* → "zh-TW",
 * everything else → "en" (the only two bundles we ship).
 *
 * Exported so test-setup + future locale-override paths can call the
 * same detection logic explicitly without mutating module state.
 */
export function detectLocale(): "en" | "zh-TW" {
  if (typeof navigator !== "undefined" && navigator.language?.startsWith("zh")) {
    return "zh-TW";
  }
  return "en";
}

/**
 * Bootstrap i18next + react-i18next.
 *
 * I-14 (PR for issue #69, 2026-05-04): `lng` parameter accepts an
 * explicit locale override. Tests pass `initI18n("en")` to get
 * deterministic strings regardless of jsdom's `navigator.language`;
 * production calls `initI18n()` (no arg → falls through to
 * `detectLocale()`). Single source of truth for the i18next config —
 * no more split-brain between production and test-setup.ts.
 */
export async function initI18n(lng?: string): Promise<I18n> {
  if (_initialized) {
    // PR #80 review (issue #80 review #1, 2026-05-04): on a subsequent
    // call, honor the caller's explicit `lng` by switching languages
    // instead of silently returning the existing instance. Without
    // this branch, `initI18n("zh-TW")` after a prior `initI18n("en")`
    // would no-op — the override was effectively first-call-only.
    // We only call changeLanguage when (a) caller passed lng AND
    // (b) it differs from the current language; bare initI18n() with
    // no arg still no-ops idempotently.
    if (lng && lng !== i18next.language) {
      await i18next.changeLanguage(lng);
    }
    return i18next;
  }

  await i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      "zh-TW": { translation: zhTW },
    },
    lng: lng ?? detectLocale(),
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
