/**
 * VS-9b.2 — Recharts SNR time-series chart.
 *
 * The component is thin: a Recharts LineChart bound to data produced by
 * `snapshotsToChartData`. Most of the testable logic lives in the helper
 * — the pure data-transformation. The component itself gets one smoke
 * test that renders given a non-trivial history and asserts the chart
 * surface is in the DOM.
 *
 * ResponsiveContainer is mocked to a fixed-dimension <div> so jsdom
 * (which returns 0×0 for getBoundingClientRect) doesn't suppress the
 * underlying SVG.
 */
import { describe, expect, test, vi } from "vitest";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { render } from "@testing-library/react";

interface ChartChildProps {
  width?: number;
  height?: number;
}

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    // Replace ResponsiveContainer with a fixed-dimension shim. Real
    // ResponsiveContainer measures its container with ResizeObserver +
    // getBoundingClientRect (both 0 in jsdom) and clones its child with
    // the measured width/height. We mimic the cloneElement step so the
    // inner LineChart actually has a layout to draw against.
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<ChartChildProps>;
    }) => {
      if (!isValidElement(children)) return children;
      return cloneElement(children, { width: 600, height: 240 });
    },
  };
});

import BeamSnrChart, {
  beamIdsFromHistory,
  snapshotsToChartData,
} from "./BeamSnrChart";
import type { MetricsSnapshot } from "../types";

const snap = (t: number, beams: Record<string, number>): MetricsSnapshot => ({
  scenario_id: "test",
  t_seconds: t,
  beams: Object.entries(beams).map(([beam_id, snr_db]) => ({
    beam_id,
    snr_db,
    sinr_db: snr_db - 2,
    latency_ms: 25,
    packet_loss_ratio: 0,
    doppler_residual_hz: 0,
    handover_state: 0,
    elevation_deg: 55,
    health: "ok" as const,
  })),
  gateways: [],
  active_anomaly: null,
  active_anomalies: [],
  scraped_at: new Date(2026, 4, 2, 0, 0, t).toISOString(),
});

describe("snapshotsToChartData", () => {
  test("returns empty for empty history", () => {
    expect(snapshotsToChartData([])).toEqual([]);
  });

  test("flattens one snapshot to {t, <beam_id>: snr_db}", () => {
    const out = snapshotsToChartData([snap(0, { "beam-1": 12.5, "beam-2": 11.0 })]);
    expect(out).toEqual([{ t: 0, "beam-1": 12.5, "beam-2": 11.0 }]);
  });

  test("preserves chronological order across multiple snapshots", () => {
    const out = snapshotsToChartData([
      snap(0, { "beam-1": 12 }),
      snap(5, { "beam-1": 10 }),
      snap(10, { "beam-1": 8 }),
    ]);
    expect(out.map((r) => r.t)).toEqual([0, 5, 10]);
    expect(out.map((r) => r["beam-1"])).toEqual([12, 10, 8]);
  });
});

describe("beamIdsFromHistory", () => {
  test("returns [] for empty history", () => {
    expect(beamIdsFromHistory([])).toEqual([]);
  });

  test("uses the LAST snapshot's beam set (not a union)", () => {
    // If the scenario reloads mid-poll the beam set may change. Use the
    // freshest snapshot so the chart reflects the *current* set, not
    // ghost lines from beams that no longer exist.
    const ids = beamIdsFromHistory([
      snap(0, { "beam-1": 12, "beam-2": 11, "beam-3": 10 }),
      snap(5, { "beam-1": 12, "beam-2": 11 }), // beam-3 removed
    ]);
    expect(ids).toEqual(["beam-1", "beam-2"]);
  });
});

describe("BeamSnrChart component (smoke)", () => {
  test("renders the empty-history placeholder when no data", () => {
    const { container } = render(<BeamSnrChart history={[]} />);
    // Placeholder is plain text; no SVG yet.
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.textContent).toMatch(/no history yet|wait for/i);
  });

  test("renders SVG line(s) when history is non-empty", () => {
    const history = [
      snap(0, { "beam-1": 12, "beam-2": 11 }),
      snap(5, { "beam-1": 10, "beam-2": 11 }),
    ];
    const { container } = render(<BeamSnrChart history={history} />);
    // Recharts emits one path.recharts-line-curve per Line component.
    const lines = container.querySelectorAll(".recharts-line");
    expect(lines.length).toBe(2);
  });
});
