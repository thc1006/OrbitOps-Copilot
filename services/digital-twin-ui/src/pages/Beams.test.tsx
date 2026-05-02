/**
 * Phase H.1.1 contract test — Beams page must surface
 * orbitops_beam_elevation_deg as a column.
 *
 * Without this test, a future "tidy-up" that drops the elevation column
 * (e.g. hiding behind a feature flag) would slip through silently and
 * regress the G7 work end-to-end.
 */
import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";

import Beams from "./Beams";
import { orbitopsTheme } from "../theme";
import type { MetricsSnapshot } from "../types";

const snapshotWith = (
  beam: Partial<MetricsSnapshot["beams"][number]>,
): MetricsSnapshot => ({
  scenario_id: "test",
  t_seconds: 90,
  beams: [
    {
      beam_id: "beam-1",
      snr_db: 6.5,
      sinr_db: 4.5,
      latency_ms: 25,
      packet_loss_ratio: 0.001,
      doppler_residual_hz: 0,
      handover_state: 0,
      elevation_deg: 55,
      health: "ok",
      ...beam,
    },
  ],
  gateways: [],
  active_anomaly: null,
  active_anomalies: [],
  scraped_at: new Date().toISOString(),
});

const wrap = (data: MetricsSnapshot | null) => (
  <ThemeProvider theme={orbitopsTheme}>
    <Beams data={data} />
  </ThemeProvider>
);

describe("Beams — H.1.1 elevation column contract", () => {
  test("renders an Elevation column header", () => {
    render(wrap(snapshotWith({})));
    expect(
      screen.getByRole("columnheader", { name: /elevation/i }),
    ).toBeInTheDocument();
  });

  test("renders the per-beam elevation value with degree unit", () => {
    render(wrap(snapshotWith({ elevation_deg: 42.7 })));
    // MetricNumber may format this several ways; we only assert that
    // both the value and the ° unit appear somewhere in the row.
    const row = screen.getByRole("row", { name: /beam-1/i });
    expect(within(row).getByText(/42.7/)).toBeInTheDocument();
    expect(within(row).getByText(/°/)).toBeInTheDocument();
  });

  test("subtitle mentions the 9 orbitops_* metric source", () => {
    render(wrap(null));
    expect(screen.getByText(/9 orbitops_\*/)).toBeInTheDocument();
  });
});

// ─── VS-9b.3 — BeamMetricChart integration (replaces VS-9b.2 SNR-only) ──
// Mock the chart at the boundary so this page-level test asserts WIRING
// (Beams hands history + metric metadata to BeamMetricChart) without
// re-validating the chart's internal Recharts rendering (covered in
// BeamMetricChart.test.tsx). The mock surfaces the metric prop on the
// rendered DOM so the assertions below can verify each of the 3 chart
// instances (SNR / Latency / Doppler) gets its own metric.
import { vi } from "vitest";

vi.mock("../components/BeamMetricChart", () => ({
  default: ({
    history,
    metric,
    title,
    unit,
  }: {
    history: MetricsSnapshot[];
    metric: string;
    title: string;
    unit: string;
  }) => (
    <div
      data-testid={`chart-${metric}`}
      data-history-length={history.length}
      data-title={title}
      data-unit={unit}
    >
      mocked-{metric} history-len={history.length}
    </div>
  ),
}));

describe("Beams — VS-9b.3 multi-metric chart integration", () => {
  test("renders 3 BeamMetricChart instances (SNR / Latency / Doppler)", () => {
    render(wrap(snapshotWith({})));
    expect(screen.getByTestId("chart-snr_db")).toBeInTheDocument();
    expect(screen.getByTestId("chart-latency_ms")).toBeInTheDocument();
    expect(screen.getByTestId("chart-doppler_residual_hz")).toBeInTheDocument();
  });

  test("each chart receives matching title + unit pair", () => {
    render(wrap(snapshotWith({})));
    expect(screen.getByTestId("chart-snr_db").dataset.title).toBe("SNR");
    expect(screen.getByTestId("chart-snr_db").dataset.unit).toBe("dB");
    expect(screen.getByTestId("chart-latency_ms").dataset.title).toBe(
      "Latency",
    );
    expect(screen.getByTestId("chart-latency_ms").dataset.unit).toBe("ms");
    expect(screen.getByTestId("chart-doppler_residual_hz").dataset.title).toBe(
      "Doppler residual",
    );
    expect(screen.getByTestId("chart-doppler_residual_hz").dataset.unit).toBe(
      "Hz",
    );
  });

  test("hands history to ALL 3 charts (history grows on data prop)", () => {
    render(wrap(snapshotWith({})));
    // useMetricsHistory accumulates; after first commit the hook's
    // useEffect has fired and pushed the prop snapshot in. All 3 charts
    // share the same history (different metrics, same window).
    for (const m of ["snr_db", "latency_ms", "doppler_residual_hz"]) {
      expect(
        Number(screen.getByTestId(`chart-${m}`).dataset.historyLength),
      ).toBe(1);
    }
  });

  test("empty data → all 3 charts get history.length=0", () => {
    render(wrap(null));
    for (const m of ["snr_db", "latency_ms", "doppler_residual_hz"]) {
      expect(screen.getByTestId(`chart-${m}`).dataset.historyLength).toBe("0");
    }
  });

  test("renders the SNR / Latency / Doppler captions above the table", () => {
    render(wrap(null));
    expect(screen.getByText(/SNR \(dB\) — last/i)).toBeInTheDocument();
    expect(screen.getByText(/Latency \(ms\) — last/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Doppler residual \(Hz\) — last/i),
    ).toBeInTheDocument();
  });
});
