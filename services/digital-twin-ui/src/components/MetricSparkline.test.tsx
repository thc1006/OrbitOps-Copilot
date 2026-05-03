/**
 * VS-9b.4 — MetricSparkline contract.
 *
 * A stripped-down BeamMetricChart for inline placement next to a metric
 * citation in the Copilot evidence panel. Differences from
 * BeamMetricChart:
 *   - one beam (filtered by beam_id prop), one metric (e.g. snr_db)
 *   - no axis labels, no legend, no tooltip — just the line shape
 *   - height ~60px (sparkline aesthetic), full container width
 *   - no empty placeholder text — empty history → renders nothing
 *     (the citation list above already says "no data yet" implicitly
 *     via empty list)
 *
 * Test pattern mirrors BeamMetricChart.test.tsx (cloneElement-with-
 * fixed-dims mock for ResponsiveContainer; ResizeObserver polyfill
 * is global in test-setup.ts).
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
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<ChartChildProps>;
    }) => {
      if (!isValidElement(children)) return children;
      return cloneElement(children, { width: 280, height: 60 });
    },
  };
});

import MetricSparkline, {
  beamSnapshotsToValues,
} from "./MetricSparkline";
import type { BeamView, MetricsSnapshot } from "../types";

const snap = (
  t: number,
  per: Record<string, Partial<BeamView>>,
): MetricsSnapshot => ({
  scenario_id: "test",
  t_seconds: t,
  beams: Object.entries(per).map(([beam_id, override]) => ({
    beam_id,
    snr_db: 12,
    sinr_db: 10,
    latency_ms: 25,
    packet_loss_ratio: 0,
    doppler_residual_hz: 0,
    handover_state: 0,
    elevation_deg: 55,
    health: "ok" as const,
    ...override,
  })),
  gateways: [],
  active_anomaly: null,
  active_anomalies: [],
  scraped_at: new Date(2026, 4, 3, 0, 0, t).toISOString(),
});

describe("beamSnapshotsToValues", () => {
  test("extracts requested metric for the requested beam_id", () => {
    const out = beamSnapshotsToValues(
      [
        snap(0, { "beam-1": { snr_db: 12 }, "beam-2": { snr_db: 11 } }),
        snap(5, { "beam-1": { snr_db: 9 }, "beam-2": { snr_db: 11 } }),
        snap(10, { "beam-1": { snr_db: 6 }, "beam-2": { snr_db: 11 } }),
      ],
      "beam-1",
      "snr_db",
    );
    expect(out).toEqual([
      { t: 0, v: 12 },
      { t: 5, v: 9 },
      { t: 10, v: 6 },
    ]);
  });

  test("skips snapshots that don't contain the requested beam_id", () => {
    // Scenario reload mid-poll: a snapshot may not have the cited beam.
    // Skip rather than emit `undefined` (Recharts hates undefined values).
    const out = beamSnapshotsToValues(
      [
        snap(0, { "beam-1": { snr_db: 12 } }),
        snap(5, { "beam-2": { snr_db: 11 } }), // beam-1 missing
        snap(10, { "beam-1": { snr_db: 9 } }),
      ],
      "beam-1",
      "snr_db",
    );
    expect(out).toEqual([
      { t: 0, v: 12 },
      { t: 10, v: 9 },
    ]);
  });

  test("returns [] for empty history", () => {
    expect(beamSnapshotsToValues([], "beam-1", "snr_db")).toEqual([]);
  });

  test("works for non-snr metrics (latency_ms, doppler_residual_hz)", () => {
    const history = [
      snap(0, { "beam-1": { latency_ms: 25, doppler_residual_hz: 100 } }),
      snap(5, { "beam-1": { latency_ms: 35, doppler_residual_hz: 1500 } }),
    ];
    expect(
      beamSnapshotsToValues(history, "beam-1", "latency_ms"),
    ).toEqual([{ t: 0, v: 25 }, { t: 5, v: 35 }]);
    expect(
      beamSnapshotsToValues(history, "beam-1", "doppler_residual_hz"),
    ).toEqual([{ t: 0, v: 100 }, { t: 5, v: 1500 }]);
  });
});

describe("MetricSparkline component", () => {
  test("empty history renders nothing visible (no SVG, no placeholder text)", () => {
    const { container } = render(
      <MetricSparkline
        history={[]}
        beamId="beam-1"
        metric="snr_db"
      />,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    // Sparkline has no placeholder text (citation list already implies
    // "no data" by being empty); container should be effectively empty.
    expect(container.textContent).toBe("");
  });

  test("renders one .recharts-line when history has matching beam values", () => {
    const { container } = render(
      <MetricSparkline
        history={[
          snap(0, { "beam-1": { snr_db: 12 } }),
          snap(5, { "beam-1": { snr_db: 9 } }),
          snap(10, { "beam-1": { snr_db: 6 } }),
        ]}
        beamId="beam-1"
        metric="snr_db"
      />,
    );
    expect(container.querySelectorAll(".recharts-line").length).toBe(1);
  });

  test("renders nothing when beam_id has no values across history", () => {
    // beam-99 doesn't appear in any snapshot → empty values → no chart
    const { container } = render(
      <MetricSparkline
        history={[
          snap(0, { "beam-1": { snr_db: 12 } }),
          snap(5, { "beam-1": { snr_db: 9 } }),
        ]}
        beamId="beam-99"
        metric="snr_db"
      />,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  // Round-2 /review C2: a single data point in Recharts LineChart
  // renders an invisible chart (a line segment needs 2 endpoints).
  // User would see an empty box for the first 5 s after asking — looks
  // like a bug. Better: render nothing until we have ≥ 2 points so the
  // sparkline only appears once it can actually convey trend info.
  test("renders nothing with only ONE data point (avoid invisible single-vertex chart)", () => {
    const { container } = render(
      <MetricSparkline
        history={[snap(0, { "beam-1": { snr_db: 12 } })]}
        beamId="beam-1"
        metric="snr_db"
      />,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
