/**
 * VS-9b.3 — generalized BeamMetricChart.
 *
 * Replaces BeamSnrChart (which only knew SNR). The new component is
 * parameterized by `metric` (a key of BeamView) + `title` + `unit` so a
 * single component renders SNR / Latency / Doppler / PacketLoss without
 * code duplication.
 *
 * Test strategy mirrors the BeamSnrChart pattern:
 *   - Pure helpers (`snapshotsToChartData`, `beamIdsFromHistory`) are
 *     tested without rendering Recharts.
 *   - Component smoke renders with the recharts ResponsiveContainer
 *     mock (cloneElement-with-fixed-dims) so SVG actually paints.
 *
 * Behaviorally distinct paths the new test set covers (vs the old
 * BeamSnrChart tests):
 *   1. metric="latency_ms" → row[beam_id] uses latency, not SNR
 *   2. metric="doppler_residual_hz" → same shape, different values
 *   3. unit prop appears in the Y-axis label
 *   4. title prop appears in the empty-history placeholder
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
      return cloneElement(children, { width: 600, height: 240 });
    },
  };
});

import BeamMetricChart, {
  beamIdsFromHistory,
  snapshotsToChartData,
} from "./BeamMetricChart";
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
  scraped_at: new Date(2026, 4, 2, 0, 0, t).toISOString(),
});

describe("snapshotsToChartData", () => {
  test("flattens the requested metric per beam", () => {
    const out = snapshotsToChartData(
      [
        snap(0, {
          "beam-1": { latency_ms: 25 },
          "beam-2": { latency_ms: 30 },
        }),
      ],
      "latency_ms",
    );
    expect(out).toEqual([{ t: 0, "beam-1": 25, "beam-2": 30 }]);
  });

  test("preserves chronological order across multiple snapshots", () => {
    const out = snapshotsToChartData(
      [
        snap(0, { "beam-1": { doppler_residual_hz: 100 } }),
        snap(5, { "beam-1": { doppler_residual_hz: 1500 } }),
        snap(10, { "beam-1": { doppler_residual_hz: 800 } }),
      ],
      "doppler_residual_hz",
    );
    expect(out.map((r) => r.t)).toEqual([0, 5, 10]);
    expect(out.map((r) => r["beam-1"])).toEqual([100, 1500, 800]);
  });

  test("works for snr_db (BeamSnrChart parity check)", () => {
    const out = snapshotsToChartData(
      [snap(0, { "beam-1": { snr_db: 12.5 }, "beam-2": { snr_db: 11 } })],
      "snr_db",
    );
    expect(out).toEqual([{ t: 0, "beam-1": 12.5, "beam-2": 11 }]);
  });

  test("returns [] for empty history", () => {
    expect(snapshotsToChartData([], "snr_db")).toEqual([]);
  });
});

describe("beamIdsFromHistory", () => {
  test("returns LATEST snapshot's beam set, not union", () => {
    const ids = beamIdsFromHistory([
      snap(0, {
        "beam-1": { snr_db: 12 },
        "beam-2": { snr_db: 11 },
        "beam-3": { snr_db: 10 },
      }),
      snap(5, {
        "beam-1": { snr_db: 12 },
        "beam-2": { snr_db: 11 },
      }),
    ]);
    expect(ids).toEqual(["beam-1", "beam-2"]);
  });

  test("returns [] for empty history", () => {
    expect(beamIdsFromHistory([])).toEqual([]);
  });
});

describe("BeamMetricChart component", () => {
  test("empty history renders title-aware placeholder", () => {
    const { container } = render(
      <BeamMetricChart
        history={[]}
        metric="latency_ms"
        title="Latency"
        unit="ms"
      />,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    // Placeholder mentions the chart's title so the user knows which
    // chart is empty (when 3 charts stack in the page, an unlabeled
    // "no history yet" gives no signal).
    expect(container.textContent).toMatch(/latency/i);
    expect(container.textContent).toMatch(/no history yet|wait for/i);
  });

  test("non-empty history → one .recharts-line per beam", () => {
    const { container } = render(
      <BeamMetricChart
        history={[
          snap(0, { "beam-1": { latency_ms: 25 }, "beam-2": { latency_ms: 30 } }),
          snap(5, { "beam-1": { latency_ms: 28 }, "beam-2": { latency_ms: 31 } }),
        ]}
        metric="latency_ms"
        title="Latency"
        unit="ms"
      />,
    );
    expect(container.querySelectorAll(".recharts-line").length).toBe(2);
  });

  test("Y-axis label uses title + unit prop", () => {
    const { container } = render(
      <BeamMetricChart
        history={[snap(0, { "beam-1": { doppler_residual_hz: 1500 } })]}
        metric="doppler_residual_hz"
        title="Doppler residual"
        unit="Hz"
      />,
    );
    // Recharts renders the YAxis label as <text>; assert title + unit
    // appear in the SVG. Used in <text> elements so textContent picks
    // them up.
    expect(container.textContent).toMatch(/Doppler residual.*Hz|Hz.*Doppler/i);
  });
});
