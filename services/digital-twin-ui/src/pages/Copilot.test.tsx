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


// ─── VS-9b.4 — MetricSparkline integration in Copilot evidence ────────
// Mock MetricSparkline at the component boundary so this page-level
// suite asserts WIRING (Copilot hands history + beamId + metric to the
// sparkline) without re-validating the chart's internal Recharts
// rendering (covered in MetricSparkline.test.tsx).

vi.mock("../components/MetricSparkline", () => ({
  default: ({
    history,
    beamId,
    metric,
  }: {
    history: MetricsSnapshot[];
    beamId: string;
    metric: string;
  }) => (
    <div
      data-testid={`mock-sparkline-${beamId}-${metric}`}
      data-history-length={history.length}
    >
      mocked-sparkline {beamId} {metric}
    </div>
  ),
}));

const RESPONSE_TWO_CITATIONS: CopilotResponse = {
  ...RESPONSE_WITH_RISK,
  evidence: {
    ...RESPONSE_WITH_RISK.evidence,
    metrics_used: [
      {
        name: "orbitops_beam_snr_db",
        labels: { beam_id: "beam-1" },
        value: 6.5,
        timestamp: "2026-05-03T01:00:00Z",
      },
      {
        name: "orbitops_link_latency_ms",
        labels: { beam_id: "beam-2" },
        value: 42,
        timestamp: "2026-05-03T01:00:00Z",
      },
    ],
  },
};

const RESPONSE_GATEWAY_CITATION: CopilotResponse = {
  ...RESPONSE_WITH_RISK,
  evidence: {
    ...RESPONSE_WITH_RISK.evidence,
    metrics_used: [
      {
        name: "orbitops_gateway_available",
        labels: { gateway_id: "gateway-pod-1" },
        value: 0,
        timestamp: "2026-05-03T01:00:00Z",
      },
    ],
  },
};

describe("Copilot — VS-9b.4 sparkline wiring", () => {
  test("renders one MetricSparkline per beam-keyed citation", async () => {
    vi.spyOn(api, "askCopilot").mockResolvedValue(RESPONSE_TWO_CITATIONS);
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId("mock-sparkline-beam-1-snr_db"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("mock-sparkline-beam-2-latency_ms"),
      ).toBeInTheDocument();
    });
  });

  test("does NOT render sparkline for gateway-keyed citations (no beam_id label)", async () => {
    vi.spyOn(api, "askCopilot").mockResolvedValue(RESPONSE_GATEWAY_CITATION);
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    // Citation text still renders (existing contract).
    await waitFor(() => {
      expect(screen.getByText(/orbitops_gateway_available/)).toBeInTheDocument();
    });
    // But no sparkline — the metric isn't beam-keyed.
    expect(
      screen.queryByTestId(/mock-sparkline-/),
    ).not.toBeInTheDocument();
  });

  test("sparkline receives the same useMetricsHistory window Beams page does", async () => {
    vi.spyOn(api, "askCopilot").mockResolvedValue(RESPONSE_WITH_RISK);
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    await waitFor(() => {
      const sl = screen.getByTestId("mock-sparkline-beam-1-snr_db");
      // After first commit useMetricsHistory has pushed SNAPSHOT once.
      expect(Number(sl.dataset.historyLength)).toBe(1);
    });
  });

  test("renders the grounded closed-loop action recommendation (VS-23)", async () => {
    vi.spyOn(api, "askCopilot").mockResolvedValue({
      ...RESPONSE_WITH_RISK,
      action_plan: {
        action_id: "set_payload_mode",
        params: { mode: "regenerative" },
        rationale: "Regenerative payload improves effective SNR on the downlink.",
        inverse_action_id: "set_payload_mode",
      },
    });
    render(wrap(SNAPSHOT));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ask copilot/i }));

    await waitFor(() => {
      expect(screen.getByText("set_payload_mode")).toBeInTheDocument();
      expect(
        screen.getByText(/Regenerative payload improves effective SNR/i),
      ).toBeInTheDocument();
    });
  });
});
