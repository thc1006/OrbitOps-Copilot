/**
 * SPEC-S004-5b follow-up — zh-TW no-english-leak smoke test.
 *
 * The bundle-shape contract in i18n.test.tsx asserts every REQUIRED_KEY
 * has a non-empty zh-TW value, but does NOT prove the components actually
 * call those keys. A typo like `t("nav.cluser")` silently leaks the
 * literal key in production but passes the contract test.
 *
 * This file mounts the App / individual pages under lng="zh-TW" and
 * asserts that previously-hardcoded English sentences do NOT appear on
 * screen. It catches:
 *   - missed migrations (string still hardcoded in JSX)
 *   - typo'd i18n keys (would render the literal key, no English match)
 *   - regressions in en/zh-TW divergence (zh-TW value accidentally
 *     copied verbatim from en source)
 *
 * Strategy: regex against every screen.queryByText(/.../). queryByText
 * with regex returns null when no match, so we assert null.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";

// SPEC-S004-13d: this test mounts <App /> which routes to
// <SatelliteView /> on /satellite-view. The real cesium + resium
// modules pull WebGL + Workers and crash jsdom. Mocks must be
// installed before App is imported.
//
// vi.mock hoists factories above all imports, so we cannot pass an
// imported function directly (would error "Cannot access '__vi_import_X__'
// before initialization"). Async factory + dynamic import works because
// the dynamic import resolves at call time, after hoisting completes.
vi.mock("resium", async () => {
  const m = await import("../test-helpers/cesium-mocks");
  return m.mockResium();
});
vi.mock("cesium", async () => {
  const m = await import("../test-helpers/cesium-mocks");
  return m.mockCesium();
});

import App from "../App";
import { orbitopsTheme } from "../theme";
import { initI18n, _resetI18nForTests } from "./index";

const stubMetrics = `
# HELP orbitops_beam_snr_db SNR
orbitops_beam_snr_db{beam_id="beam-1"} 6.5
orbitops_beam_snr_db{beam_id="beam-2"} 13.0
`;

beforeAll(async () => {
  // Switch the global i18next singleton to zh-TW for the whole file.
  // The companion `afterAll` restores it so subsequent test files (which
  // assume en) are not contaminated when vitest re-uses the worker.
  _resetI18nForTests();
  await initI18n("zh-TW");
});

afterAll(async () => {
  _resetI18nForTests();
  await initI18n("en");
});

beforeEach(() => {
  // VS-19 AC-S003-VS19.10: ProtectedRoute reads localStorage.orbitops_token.
  // Supply a fake token so all render paths reach the actual page content
  // instead of redirecting to /login.
  localStorage.setItem("orbitops_token", "test-token-for-zh-leak-tests");

  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.endsWith("/scenario/current")) {
        return new Response(
          JSON.stringify({
            scenario_id: "beam-degradation-001",
            t: 90,
            active_anomalies: ["snr_drop"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/metrics")) {
        return new Response(stubMetrics, {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem("orbitops_token");
});

const wrap = (path = "/") => (
  <ThemeProvider theme={orbitopsTheme}>
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  </ThemeProvider>
);

// English sentences / words that previously appeared as hardcoded JSX
// text on the migrated pages. If any of these renders under zh-TW, a
// migration regressed. Each entry is the English source string before
// migration; pick a discriminating substring.
const ENGLISH_LEAK_PATTERNS_LAYOUT: RegExp[] = [
  /\bCluster\b/, /\bWorkloads\b/, /\bAI Ops\b/, /\bEvents\b/, /\bExternal\b/,
  /\bRefresh metrics\b/, /Sprint 1 · Local/,
];

const ENGLISH_LEAK_PATTERNS_OVERVIEW: RegExp[] = [
  /\bActive anomalies\b/, /\bTick t\b/, /\bBeam summary\b/,
  /\bBeam ID\b/, /\bHandover\b/, /\bStatus\b/,
  /No beams\. Load a scenario from/,
];

const ENGLISH_LEAK_PATTERNS_GATEWAYS: RegExp[] = [
  /No gateways\. Load a scenario first\./,
  /Per-gateway availability/,
];

const ENGLISH_LEAK_PATTERNS_COPILOT: RegExp[] = [
  /Ask about beam health/, /\bAsk Copilot\b/, /\bAsking…\b/,
  /Evidence-grounded NTN ops assistant/,
  /Copilot response/, /\bSummary\b/, /Likely cause/,
  /Recommended actions/, /Risk if ignored/, /Metric citations/,
  /Which beam is degrading/, /Is any gateway at risk/,
];

const ENGLISH_LEAK_PATTERNS_SCENARIOS: RegExp[] = [
  /Load beam-degradation/, /Load handover-failure/, /Load gateway-fallback/,
  /Ready for Copilot/,
  /Custom-JSON load is VS-3 future work/,
  // Per chain #3: feedback strings that were partial-migrations in the
  // initial commit must now be zh-TW too.
  /\bloaded,\s*t = /, /Load failed before any state changed/,
];

// SPEC-S004-13d (VS-13 S5): Play / Pause / Reset must localize.
const ENGLISH_LEAK_PATTERNS_SATELLITE: RegExp[] = [
  /\bPlay\b/, /\bPause\b/, /\bReset\b/,
];

function expectNoEnglishLeak(patterns: RegExp[], where: string): void {
  for (const pat of patterns) {
    expect(
      screen.queryByText(pat),
      `English leak in ${where}: ${pat}`,
    ).toBeNull();
  }
}

describe("zh-TW no-english-leak (SPEC-S004-5b)", () => {
  test("Layout (SideNav + TopBar) is fully zh-TW", async () => {
    render(wrap("/"));
    await waitFor(() => {
      // Confirm we actually landed in zh-TW first — page renders before
      // we can meaningfully assert leak absence.
      expect(screen.getAllByText("叢集").length).toBeGreaterThan(0);
    });
    expectNoEnglishLeak(ENGLISH_LEAK_PATTERNS_LAYOUT, "Layout");
  });

  test("Overview page is fully zh-TW", async () => {
    render(wrap("/"));
    await waitFor(() => {
      // Sentinel zh-TW string from overview.beamSummary
      expect(screen.getByText("波束摘要")).toBeInTheDocument();
    });
    expectNoEnglishLeak(ENGLISH_LEAK_PATTERNS_OVERVIEW, "Overview");
  });

  test("Gateways page is fully zh-TW", async () => {
    render(wrap("/gateways"));
    await waitFor(() => {
      // sentinel: gateways.empty in zh-TW
      expect(screen.getByText(/尚無閘道/)).toBeInTheDocument();
    });
    expectNoEnglishLeak(ENGLISH_LEAK_PATTERNS_GATEWAYS, "Gateways");
  });

  test("Copilot page is fully zh-TW", async () => {
    render(wrap("/copilot"));
    await waitFor(() => {
      // Sentinel zh-TW: copilot.askButton
      expect(screen.getAllByText(/請教 Copilot/).length).toBeGreaterThan(0);
    });
    expectNoEnglishLeak(ENGLISH_LEAK_PATTERNS_COPILOT, "Copilot");
  });

  test("Scenarios page is fully zh-TW", async () => {
    render(wrap("/scenarios"));
    await waitFor(() => {
      expect(screen.getByText(/載入 beam-degradation/)).toBeInTheDocument();
    });
    expectNoEnglishLeak(ENGLISH_LEAK_PATTERNS_SCENARIOS, "Scenarios");
  });

  test("SatelliteView page is fully zh-TW (SPEC-S004-13d Play/Pause/Reset)", async () => {
    render(wrap("/satellite-view"));
    await waitFor(() => {
      // sentinel zh-TW: satellite.playback.play
      expect(screen.getByRole("button", { name: /播放/ })).toBeInTheDocument();
    });
    expectNoEnglishLeak(ENGLISH_LEAK_PATTERNS_SATELLITE, "SatelliteView");
  });
});
