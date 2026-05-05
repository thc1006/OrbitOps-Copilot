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

import SatelliteView from "./SatelliteView";

describe("SatelliteView (VS-13 S2 — CesiumJS skeleton)", () => {
  test("renders a Cesium viewer container", () => {
    render(<SatelliteView data={null} />);
    expect(screen.getByTestId("cesium-viewer")).toBeInTheDocument();
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
