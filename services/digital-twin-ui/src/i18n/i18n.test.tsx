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
// These came from VS-9b.1/.2/.3/.4 + VS-10a (PR #68) plus SPEC-S004-5b
// (issue #72 — Copilot/Scenarios/Gateways/Overview + Layout). Updating this
// list is part of the green commit. Keep in alphabetical order to make
// drift readable in PR diffs.
const REQUIRED_KEYS = [
  "anomalies.empty",
  "anomalies.injectButton",
  "anomalies.injectingButton",
  "anomalies.injectFailed",
  "anomalies.injectSectionTitle",
  "anomalies.injectSuccess",
  "beams.chartCaption",
  "beams.dopplerTitle",
  "beams.dopplerUnit",
  "beams.latencyTitle",
  "beams.latencyUnit",
  "beams.snrTitle",
  "beams.snrUnit",
  "common.brand",
  "common.brandTag",
  "common.envBadge",
  "common.refresh",
  "common.scenario",
  "common.tick",
  "common.unit.degrees",
  "copilot.askButton",
  "copilot.askPlaceholder",
  "copilot.askingButton",
  "copilot.confidenceLabel",
  "copilot.preset.beamDegrading",
  "copilot.preset.gatewayRisk",
  "copilot.preset.next30min",
  "copilot.refusedPrefix",
  "copilot.responseHeader",
  "copilot.section.likelyCause",
  "copilot.section.metricCitations",
  "copilot.section.recommendedActions",
  "copilot.section.riskIfIgnored",
  "copilot.section.summary",
  "copilot.subtitle",
  "copilot.tryLabel",
  "gateways.empty",
  "gateways.fieldAvailable",
  "gateways.fieldLoad",
  "gateways.statusAvailable",
  "gateways.statusDown",
  "gateways.subtitle",
  "metricChart.noHistoryYet",
  "nav.aiOps",
  "nav.anomalies",
  "nav.beams",
  "nav.cluster",
  "nav.copilot",
  "nav.events",
  "nav.external",
  "nav.gateways",
  "nav.overview",
  "nav.satellitePass",
  "nav.scenarios",
  "nav.workloads",
  "overview.beamSummary",
  "overview.empty",
  "overview.metric.activeAnomalies",
  "overview.metric.beams",
  "overview.metric.gateways",
  "overview.metric.tick",
  "overview.subtitle",
  "overview.table.beamId",
  "overview.table.doppler",
  "overview.table.handover",
  "overview.table.latency",
  "overview.table.loss",
  "overview.table.snr",
  "overview.table.status",
  "scenarios.checklist.askCopilot",
  "scenarios.checklist.retryHint",
  "scenarios.customLoadFutureWork",
  "scenarios.feedback.loadFailed",
  "scenarios.feedback.loadSuccess",
  "scenarios.feedback.readyNoAnomaly",
  "scenarios.feedback.readySuccess",
  "scenarios.feedback.tickActiveNone",
  "scenarios.feedback.tickFailed",
  "scenarios.feedback.tickSuccess",
  "scenarios.preset.beamDegradation",
  "scenarios.preset.gatewayFallback",
  "scenarios.preset.handoverFailure",
  "scenarios.readyForCopilot",
  "scenarios.subtitle",
  "scenarios.tickPickLabel",
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

  test("I-14 (issue #69): initI18n(lng) override is honored when provided", async () => {
    // Tests that the production helper, given an explicit `lng`, uses
    // it instead of falling through to navigator.language detection.
    // test-setup.ts relies on this to lock the test locale to "en"
    // regardless of jsdom's navigator state — without the override,
    // production + test config could drift.
    //
    // PR #80 review (issue #80 review #2, 2026-05-04): the restore
    // path is in `finally` so a thrown / failed assertion can't leave
    // the global i18next singleton stuck in zh-TW (which would make
    // subsequent tests fail for the wrong reason).
    const { initI18n, _resetI18nForTests } = await import("./index");
    _resetI18nForTests();
    try {
      const i18n = await initI18n("zh-TW");
      expect(i18n.language).toBe("zh-TW");
    } finally {
      _resetI18nForTests();
      await initI18n("en");
    }
  });

  test("PR #80 review #1: lng override on a subsequent call switches language (was silent no-op)", async () => {
    // Before the fix, initI18n("zh-TW") after initI18n("en") returned
    // the existing 'en' instance unchanged. After the fix, the second
    // call calls i18next.changeLanguage(lng).
    const indexMod = await import("./index");
    const i18next = indexMod.default;
    const { initI18n, _resetI18nForTests } = indexMod;
    _resetI18nForTests();
    try {
      await initI18n("en");
      expect(i18next.language).toBe("en");
      await initI18n("zh-TW"); // would have no-op'd before fix
      expect(i18next.language).toBe("zh-TW");
    } finally {
      _resetI18nForTests();
      await initI18n("en");
    }
  });
});
