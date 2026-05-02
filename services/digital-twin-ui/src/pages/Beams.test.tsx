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

// ─── VS-9b.2 — BeamSnrChart integration ───────────────────────────────
// Mock the chart at the boundary so this page-level test asserts WIRING
// (Beams hands history to BeamSnrChart) without re-validating the
// chart's internal Recharts rendering (covered in BeamSnrChart.test.tsx).
//
// useMetricsHistory needs at least one effect cycle to push the prop
// snapshot into its internal state. testing-library/react flushes
// effects synchronously after `render()`, so the mocked chart sees
// history.length=1 after the first render with a non-null `data` prop.
import { vi } from "vitest";

vi.mock("../components/BeamSnrChart", () => ({
  default: ({ history }: { history: MetricsSnapshot[] }) => (
    <div data-testid="beam-snr-chart" data-history-length={history.length}>
      mocked-chart history-len={history.length}
    </div>
  ),
}));

describe("Beams — VS-9b.2 BeamSnrChart integration", () => {
  test("renders BeamSnrChart placeholder with empty history when data is null", () => {
    render(wrap(null));
    const chart = screen.getByTestId("beam-snr-chart");
    expect(chart).toBeInTheDocument();
    expect(chart.dataset.historyLength).toBe("0");
  });

  test("hands the latest snapshot to BeamSnrChart (history grows on data prop)", () => {
    render(wrap(snapshotWith({})));
    const chart = screen.getByTestId("beam-snr-chart");
    // useMetricsHistory accumulates; after first commit the hook's
    // useEffect has fired and pushed the prop snapshot in.
    expect(Number(chart.dataset.historyLength)).toBe(1);
  });

  test("renders the SNR (dB) chart caption above the table", () => {
    render(wrap(null));
    expect(screen.getByText(/SNR \(dB\) — last/i)).toBeInTheDocument();
  });
});
