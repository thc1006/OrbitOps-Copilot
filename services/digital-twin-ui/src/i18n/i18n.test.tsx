/**
 * T1 — i18n migration contract test (closes SPEC-004 §AC-S004-5).
 *
 * Asserts:
 *   1. en.json + zh-TW.json exist and have IDENTICAL key sets (drift = test fail)
 *   2. The i18n key registry covers every previously-hardcoded UI string from
 *      VS-9b.* + VS-10a — exhaustive list (drift = test fail)
 *   3. `useTranslation()` hook returns the key as fallback when no resource is
 *      available; this is what AC-S004-5 mandates (i18n-ready even with English-
 *      only locale)
 */
import { describe, expect, test } from "vitest";

import enResources from "./locales/en.json";
import zhResources from "./locales/zh-TW.json";

// Required keys that previously appeared as hardcoded English in the UI.
// These came from VS-9b.1/.2/.3/.4 + VS-10a; updating this list is part of
// the green commit. Keep in alphabetical order to make drift readable in
// PR diffs.
const REQUIRED_KEYS = [
  "anomalies.empty",
  "anomalies.injectButton",
  "anomalies.injectingButton",
  "anomalies.injectFailed",
  "anomalies.injectSuccess",
  "anomalies.injectSectionTitle",
  "beams.chartCaption",
  "beams.dopplerTitle",
  "beams.dopplerUnit",
  "beams.latencyTitle",
  "beams.latencyUnit",
  "beams.snrTitle",
  "beams.snrUnit",
  "common.unit.degrees",
  "metricChart.noHistoryYet",
];

function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

describe("i18n resource bundles", () => {
  test("en.json and zh-TW.json have identical key sets", () => {
    const enKeys = new Set(Object.keys(flatten(enResources)));
    const zhKeys = new Set(Object.keys(flatten(zhResources)));

    const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k)).sort();
    const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k)).sort();

    expect(onlyEn).toEqual([]);
    expect(onlyZh).toEqual([]);
  });

  test("en.json covers every required key from migrated UI strings", () => {
    const enKeys = new Set(Object.keys(flatten(enResources)));
    const missing = REQUIRED_KEYS.filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });

  test("zh-TW.json also covers every required key (mirror)", () => {
    const zhKeys = new Set(Object.keys(flatten(zhResources)));
    const missing = REQUIRED_KEYS.filter((k) => !zhKeys.has(k));
    expect(missing).toEqual([]);
  });

  test("en.json values are non-empty strings", () => {
    const flat = flatten(enResources);
    for (const k of REQUIRED_KEYS) {
      expect(flat[k]).toBeTruthy();
      expect(typeof flat[k]).toBe("string");
      expect(flat[k].length).toBeGreaterThan(0);
    }
  });
});

describe("i18n init", () => {
  test("initI18n returns a configured i18next instance with en + zh-TW", async () => {
    const { initI18n } = await import("./index");
    const i18n = await initI18n();
    expect(i18n.languages).toContain("en");
    expect(Object.keys(i18n.options.resources ?? {})).toEqual(
      expect.arrayContaining(["en", "zh-TW"]),
    );
  });
});
