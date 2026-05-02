/**
 * Phase H.1.2 contract test — Anomalies page must describe all 5
 * producer-emitted scenario events + the Copilot-derived
 * doppler_compensation_warning. Pre-H.1.2 only 3 of 6 had descriptions
 * and the rest fell back to "Unknown anomaly type".
 */
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";

import Anomalies from "./Anomalies";
import { orbitopsTheme } from "../theme";
import type { MetricsSnapshot } from "../types";

const snapshotWithAnomalies = (kinds: string[]): MetricsSnapshot => ({
  scenario_id: "test",
  t_seconds: 0,
  beams: [],
  gateways: [],
  active_anomaly: kinds[0] ?? null,
  active_anomalies: kinds,
  scraped_at: new Date().toISOString(),
});

const wrap = (data: MetricsSnapshot | null) => (
  <ThemeProvider theme={orbitopsTheme}>
    <Anomalies data={data} />
  </ThemeProvider>
);

describe("Anomalies — H.1.2 description coverage", () => {
  test("no active anomalies → success banner", () => {
    render(wrap(snapshotWithAnomalies([])));
    expect(screen.getByText(/No active anomalies/i)).toBeInTheDocument();
  });

  // All 5 producer-emitted scenario event types must have non-fallback
  // descriptions. Copilot-derived classifications (e.g.
  // doppler_compensation_warning) are intentionally NOT in this dictionary —
  // they only appear via Copilot response on the Copilot page; see the
  // module-level comment in Anomalies.tsx.
  test.each([
    ["snr_drop", /link-adaptation threshold/i],
    ["handover_failure", /handover did not complete/i],
    ["doppler_spike", /Scenario-injected Doppler/i],
    ["gateway_outage", /gateway availability/i],
    ["packet_loss_spike", /packet-loss ratio jumped/i],
  ])("describes %s with non-fallback text", (kind, pattern) => {
    render(wrap(snapshotWithAnomalies([kind])));
    expect(screen.getByText(pattern)).toBeInTheDocument();
    expect(screen.queryByText(/Unknown anomaly type/i)).not.toBeInTheDocument();
  });
});
