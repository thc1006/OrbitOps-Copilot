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
