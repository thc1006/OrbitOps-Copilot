/**
 * Phase H.1.4 contract test — Copilot page must surface
 * `risk_if_ignored` (top-level CopilotResponse field) and the 4
 * evidence metadata fields beyond just metrics_used.
 *
 * Pre-H.1.4 only summary/likely_cause/recommended_actions/metrics_used/
 * unknowns were rendered; risk_if_ignored + scenario_id +
 * time_window_seconds + timestamp + logs_used count were silently
 * dropped despite the backend emitting them.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";

import Copilot from "./Copilot";
import { orbitopsTheme } from "../theme";
import * as api from "../api";
import type { CopilotResponse, MetricsSnapshot } from "../types";

const RESPONSE_WITH_RISK: CopilotResponse = {
  summary: "Beam-1 SNR degradation detected.",
  likely_cause: "Low elevation + transient RF shift.",
  evidence: {
    metrics_used: [
      { name: "orbitops_beam_snr_db", labels: { beam_id: "beam-1" }, value: 6.5, timestamp: "2026-05-02T07:00:00Z" },
    ],
    logs_used: [],
    scenario_id: "beam-degradation-001",
    time_window_seconds: 60,
    timestamp: "2026-05-02T07:00:00Z",
  },
  recommended_actions: [
    { step: 1, title: "Trigger handover", body: "Hand over beam-1 traffic." },
  ],
  risk_if_ignored:
    "Continued packet loss escalating to full link drop once SNR < 4 dB.",
  confidence: 0.78,
  unknowns: ["Whether RF interference dominates."],
  status: "ok",
  refusal_reason: null,
  error: null,
};

const SNAPSHOT: MetricsSnapshot = {
  scenario_id: "beam-degradation-001",
  t_seconds: 90,
  beams: [],
  gateways: [],
  active_anomaly: "snr_drop",
  active_anomalies: ["snr_drop"],
  scraped_at: new Date().toISOString(),
};

const wrap = (data: MetricsSnapshot | null) => (
  <ThemeProvider theme={orbitopsTheme}>
    <Copilot data={data} />
  </ThemeProvider>
);

beforeEach(() => {
  vi.spyOn(api, "askCopilot").mockResolvedValue(RESPONSE_WITH_RISK);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Copilot — H.1.4 risk_if_ignored + evidence metadata", () => {
  test("renders 'Risk if ignored' section with the response text", async () => {
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    await waitFor(() => {
      expect(screen.getByText(/Risk if ignored/i)).toBeInTheDocument();
      expect(
        screen.getByText(/escalating to full link drop/i),
      ).toBeInTheDocument();
    });
  });

  test("renders all 4 evidence-metadata fields in the footer", async () => {
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    await waitFor(() => {
      // scenario_id
      expect(screen.getByText("beam-degradation-001")).toBeInTheDocument();
      // time_window_seconds — appears as the literal number
      expect(screen.getByText("60")).toBeInTheDocument();
      // timestamp — ISO string
      expect(screen.getByText("2026-05-02T07:00:00Z")).toBeInTheDocument();
      // logs_used count + Sprint-2 forward-reference
      expect(screen.getByText(/Loki integration is Sprint-2/i)).toBeInTheDocument();
    });
  });

  test("when risk_if_ignored is null, the section is NOT rendered", async () => {
    vi.spyOn(api, "askCopilot").mockResolvedValueOnce({
      ...RESPONSE_WITH_RISK,
      risk_if_ignored: null,
    });
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    await waitFor(() => {
      // The Summary block must still render so we know the response did arrive.
      expect(screen.getByText(/Beam-1 SNR degradation/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Risk if ignored/i)).not.toBeInTheDocument();
  });
});
