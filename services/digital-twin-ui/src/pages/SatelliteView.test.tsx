/**
 * VS-13 S2 — SatelliteView page contract test (closes SPEC-004 §AC-S004-3).
 *
 * Asserts the CesiumJS satellite-pass viewer is mounted under
 * `/satellite-view` and exposes the contract surfaces that S3
 * (pass animation) and S4 (beam coverage cones) build on:
 *
 *   1. The page renders a Cesium viewer container (mocked resium
 *      `<Viewer>` so jsdom doesn't try to load 3 MB of WebGL runtime)
 *   2. A ground-station Entity is present at NYCU's lat/lon (24.787, 120.998)
 *   3. CESIUM_BASE_URL is reachable as a global at runtime (set via
 *      vite.config.ts `define:`); tests assert the constant exists
 *      so a vite config regression that drops the define is caught
 *      before it breaks production
 *
 * Mock strategy: `resium` + `cesium` are 100% mocked. The real modules
 * are too heavy for jsdom (cesium pulls in WebGL, terrain assets, and
 * worker scripts). We assert the React tree shape only.
 */
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// VS-13 S5: cesium + resium mocks extracted to a shared helper so the
// zh-no-english-leak smoke test can mount <App /> (which routes to
// <SatelliteView />) without duplicating ~50 lines of mock scaffolding.
//
// vi.mock hoists factories above all imports — passing an imported
// function reference fails ("Cannot access __vi_import_X__ before
// initialization"). Async factory + dynamic import resolves at call
// time, after hoisting completes.
vi.mock("resium", async () => {
  const m = await import("../test-helpers/cesium-mocks");
  return m.mockResium();
});
vi.mock("cesium", async () => {
  const m = await import("../test-helpers/cesium-mocks");
  return m.mockCesium();
});

// SPEC-S004-13e — mock MetricSparkline at the component boundary
// so the SNR sparkline panel tests can assert "one sparkline per beam"
// without re-validating the chart's internal Recharts rendering
// (covered by MetricSparkline.test.tsx). Mirrors Copilot.test.tsx mock.
vi.mock("../components/MetricSparkline", () => ({
  default: ({ beamId, metric }: { beamId: string; metric: string }) => (
    <div data-testid={`mock-sparkline-${beamId}-${metric}`}>
      mocked-sparkline {beamId} {metric}
    </div>
  ),
}));

import SatelliteView from "./SatelliteView";
import type { MetricsSnapshot } from "../types";

describe("SatelliteView (VS-13 S2 — CesiumJS skeleton)", () => {
  test("renders a Cesium viewer container", () => {
    render(<SatelliteView data={null} />);
    expect(screen.getByTestId("cesium-viewer")).toBeInTheDocument();
  });

  test("ADR-011: <Viewer> receives an offline ImageryLayer baseLayer (no Ion fallback)", () => {
    // Per ADR-011 (offline-first cesium imagery): the production
    // <Viewer> MUST be invoked with an explicit `baseLayer` prop sourced
    // from `ImageryLayer.fromProviderAsync(TileMapServiceImageryProvider
    // .fromUrl(...))`. Without this prop, Cesium's constructor falls
    // back to Ion-backed Bing imagery and prints the "default ion access
    // token" warning + 401s once the demo token's quota is exhausted.
    //
    // The resium mock (test-helpers/cesium-mocks.tsx) inspects the
    // baseLayer prop's __mock discriminator and surfaces both presence
    // and kind via data-* attributes. A future regression that removes
    // the baseLayer prop would flip data-has-base-layer to "false" and
    // data-base-layer-kind to "(default-ion-backed)" — fail-loud here.
    render(<SatelliteView data={null} />);
    const viewer = screen.getByTestId("cesium-viewer");
    expect(viewer.dataset.hasBaseLayer).toBe("true");
    expect(viewer.dataset.baseLayerKind).toBe(
      "ImageryLayer.fromProviderAsync",
    );
  });

  test("renders an NYCU ground-station entity", () => {
    render(<SatelliteView data={null} />);
    // Ground station name is the contract surface S3 (pass animation)
    // will use to anchor the orbit polyline and S4 (beam cones) will
    // use to anchor coverage ellipsoids. If this entity disappears
    // those features break silently.
    expect(
      screen.getByTestId("cesium-entity-NYCU-Ground-Station"),
    ).toBeInTheDocument();
  });

  test("has CESIUM_BASE_URL globally defined at runtime", () => {
    // vite.config.ts injects this via `define:` so cesium can resolve
    // its Workers / Assets / Widgets at runtime. If it's missing, the
    // browser hits 404s on cesium worker scripts and the viewer
    // silently fails to render terrain. Test guards the vite config.
    const w = globalThis as unknown as { CESIUM_BASE_URL?: string };
    expect(typeof w.CESIUM_BASE_URL).toBe("string");
    expect(w.CESIUM_BASE_URL).toMatch(/^\/cesium/);
  });
});

describe("SatelliteView (VS-13 S4 — beam coverage cones)", () => {
  test("renders one cone Entity per beam when data has beams", () => {
    const snapshot = {
      scenario_id: "test",
      t_seconds: 30,
      beams: [
        {
          beam_id: "beam-1",
          snr_db: 15,
          sinr_db: 12,
          latency_ms: 25,
          packet_loss_ratio: 0.001,
          doppler_residual_hz: 0,
          handover_state: 0 as const,
          elevation_deg: 60,
          health: "ok" as const,
        },
        {
          beam_id: "beam-2",
          snr_db: 4,
          sinr_db: 2,
          latency_ms: 80,
          packet_loss_ratio: 0.05,
          doppler_residual_hz: 1500,
          handover_state: 1 as const,
          elevation_deg: 25,
          health: "crit" as const,
        },
      ],
      gateways: [],
      active_anomaly: null,
      active_anomalies: [],
      scraped_at: new Date().toISOString(),
    };
    render(<SatelliteView data={snapshot} />);
    // Each beam → its own Entity named "Beam <id> coverage cone"
    expect(
      screen.getByTestId("cesium-entity-Beam-beam-1-coverage-cone"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cesium-entity-Beam-beam-2-coverage-cone"),
    ).toBeInTheDocument();
  });

  test("renders no cones when data is null (no scenario loaded)", () => {
    render(<SatelliteView data={null} />);
    expect(screen.queryByTestId(/cesium-entity-Beam-/)).not.toBeInTheDocument();
  });
});

// ─── VS-13 S5 — animated satellite + play/pause (SPEC-S004-13d) ────────
//
// Vitest fake-timer hygiene per SPEC §6:
//   - useFakeTimers in beforeEach + useRealTimers in afterEach
//   - act() wrapper around advanceTimersByTime to silence React 19
//     "state update outside act" warnings when the interval callback
//     flushes setState
//
// The satellite Entity exposes a test-only `data-pass-fraction` attr
// so tests assert the animation state without poking React internals.

import { afterEach, beforeEach } from "vitest";
import { act, fireEvent } from "@testing-library/react";

describe("SatelliteView (VS-13 S5 — animated pass)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders Play / Pause / Reset buttons with i18n labels", () => {
    render(<SatelliteView data={null} />);
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  test("clicking Play advances data-pass-fraction; Pause freezes it", () => {
    render(<SatelliteView data={null} />);
    const sat = screen.getByTestId("cesium-entity-Satellite");
    expect(sat.getAttribute("data-pass-fraction")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const fracAfterPlay = Number(sat.getAttribute("data-pass-fraction"));
    expect(fracAfterPlay).toBeGreaterThan(0);
    expect(fracAfterPlay).toBeLessThan(1);

    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(Number(sat.getAttribute("data-pass-fraction"))).toBeCloseTo(
      fracAfterPlay,
      6,
    );
  });

  test("Reset returns fraction to 0 and stops playback", () => {
    render(<SatelliteView data={null} />);
    const sat = screen.getByTestId("cesium-entity-Satellite");
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(Number(sat.getAttribute("data-pass-fraction"))).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(sat.getAttribute("data-pass-fraction")).toBe("0");

    // After reset, advancing time must NOT re-advance fraction (Reset
    // also stops playback per AC-S004-13d.4).
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(sat.getAttribute("data-pass-fraction")).toBe("0");
  });
});

// ─── SPEC-S004-13e — ops-console redesign (4 telemetry panels) ────────
//
// AC-S004-13e.{1..7} bound to test surface here. The Cesium runtime
// remains [skip-tdd] (jsdom limitation), but the React composition of
// the 4 telemetry panels is fully testable via the existing mocks.

const SNAPSHOT_WITH_DEGRADED_BEAM: MetricsSnapshot = {
  scenario_id: "beam-degradation-001",
  t_seconds: 90,
  beams: [
    {
      beam_id: "beam-1",
      snr_db: 6.5,
      sinr_db: 4.2,
      latency_ms: 80,
      packet_loss_ratio: 0.05,
      doppler_residual_hz: 1500,
      handover_state: 2 as const,
      elevation_deg: 25,
      health: "crit" as const,
    },
    {
      beam_id: "beam-2",
      snr_db: 13.0,
      sinr_db: 11.5,
      latency_ms: 25,
      packet_loss_ratio: 0.001,
      doppler_residual_hz: 50,
      handover_state: 1 as const,
      elevation_deg: 60,
      health: "ok" as const,
    },
    {
      beam_id: "beam-3",
      snr_db: 11.5,
      sinr_db: 9.0,
      latency_ms: 30,
      packet_loss_ratio: 0.002,
      doppler_residual_hz: 80,
      handover_state: 0 as const,
      elevation_deg: 45,
      health: "ok" as const,
    },
  ],
  gateways: [],
  active_anomaly: "snr_drop",
  active_anomalies: ["snr_drop"],
  scraped_at: new Date().toISOString(),
};

describe("SatelliteView (SPEC-S004-13e — ops-console panels)", () => {
  test("AC-13e.1: anomaly banner is hidden when no active anomalies", () => {
    render(<SatelliteView data={null} />);
    // The banner uses MUI Alert which renders role=alert.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("AC-13e.1: anomaly banner appears with active_anomalies + cites kind", () => {
    render(<SatelliteView data={SNAPSHOT_WITH_DEGRADED_BEAM} />);
    const banner = screen.getByRole("alert");
    expect(banner).toBeInTheDocument();
    // i18n string "{{kind}} active at scenario t = {{t}}s — {{count}} beam(s) degraded"
    // — assert the interpolation pulled the snr_drop kind through.
    expect(banner).toHaveTextContent(/snr_drop/);
  });

  test("AC-13e.2: active beams panel renders one row per beam", () => {
    render(<SatelliteView data={SNAPSHOT_WITH_DEGRADED_BEAM} />);
    // beam_id appears in the active-beams panel; getAllByText covers
    // potential duplicates (e.g. inside sparkline labels).
    expect(screen.getAllByText("beam-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("beam-2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("beam-3").length).toBeGreaterThan(0);
  });

  test("AC-13e.3: active beams panel shows empty-state text when data is null", () => {
    render(<SatelliteView data={null} />);
    // The i18n key resolves to "No beams active. Load a scenario from Scenarios."
    // when no resource is loaded test-setup falls back to the EN string.
    expect(
      screen.getByText(/No beams active|目前無作用中波束/),
    ).toBeInTheDocument();
  });

  test("AC-13e.4: handover events panel filters by handover_state > 0", () => {
    render(<SatelliteView data={SNAPSHOT_WITH_DEGRADED_BEAM} />);
    // Snapshot has beam-1 (state=2 FAILURE), beam-2 (state=1 preparing),
    // beam-3 (state=0 stable). Both labels should be visible somewhere
    // in the document.
    expect(screen.getByText(/FAILURE|失敗/)).toBeInTheDocument();
    expect(screen.getByText(/preparing|準備中/)).toBeInTheDocument();
  });

  test("AC-13e.5: SNR sparkline panel renders one MetricSparkline per beam", () => {
    render(<SatelliteView data={SNAPSHOT_WITH_DEGRADED_BEAM} />);
    expect(
      screen.getByTestId("mock-sparkline-beam-1-snr_db"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("mock-sparkline-beam-2-snr_db"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("mock-sparkline-beam-3-snr_db"),
    ).toBeInTheDocument();
  });

  test("AC-13e.6: section header uses nav.* shared keys (no hardcoded English)", () => {
    render(<SatelliteView data={null} />);
    // "Workloads" comes from t("nav.workloads") — same key the SideNav
    // renders. If a future regression switches back to hardcoded
    // "Visualization", this test fails because the i18n string
    // "Workloads" won't be in the rendered SectionHeader.
    expect(screen.getAllByText("Workloads").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Satellite Pass").length).toBeGreaterThan(0);
  });
});
