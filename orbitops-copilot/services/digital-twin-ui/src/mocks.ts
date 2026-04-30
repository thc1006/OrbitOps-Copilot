// Mock data for offline / testing / demo-stable modes.
// Mirrors `packages/scenarios/beam-degradation.json` at t=90s mid-anomaly.

import type { CopilotResponse, MetricsSnapshot } from "./types";

export const MOCK_METRICS: MetricsSnapshot = {
  scenario_id: "beam-degradation-001",
  t_seconds: 90,
  active_anomaly: "snr_drop",
  beams: [
    {
      beam_id: "beam-1",
      snr_db: 6.5,
      sinr_db: 4.5,
      latency_ms: 25,
      packet_loss_ratio: 0.001,
      doppler_residual_hz: 0,
      handover_state: 0,
      health: "crit",
    },
    {
      beam_id: "beam-2",
      snr_db: 13.0,
      sinr_db: 11.0,
      latency_ms: 25,
      packet_loss_ratio: 0.001,
      doppler_residual_hz: 0,
      handover_state: 0,
      health: "ok",
    },
    {
      beam_id: "beam-3",
      snr_db: 11.5,
      sinr_db: 9.5,
      latency_ms: 25,
      packet_loss_ratio: 0.001,
      doppler_residual_hz: 0,
      handover_state: 0,
      health: "ok",
    },
  ],
};

export const MOCK_COPILOT_OK: CopilotResponse = {
  summary:
    "Beam SNR degradation detected on beam-1. Cited orbitops_beam_snr_db dropped to 6.5 dB during the pass.",
  likely_cause:
    "SNR on beam-1 fell below the link-adaptation threshold of 8 dB. Most consistent with low-elevation beam pointing combined with a transient RF environment shift; rain-fade and pointing error are the two leading hypotheses.",
  evidence: {
    metrics_used: [
      {
        name: "orbitops_beam_snr_db",
        labels: { beam_id: "beam-1" },
        value: 6.5,
        timestamp: "2026-04-30T12:01:30Z",
      },
    ],
    logs_used: [],
    scenario_id: "beam-degradation-001",
    time_window_seconds: 60,
    timestamp: "2026-04-30T12:01:30Z",
  },
  recommended_actions: [
    {
      step: 1,
      title: "Trigger handover to next-best beam",
      body: "Hand over beam-1 traffic to the highest-elevation neighbouring beam to restore SNR margin.",
    },
    {
      step: 2,
      title: "Verify Doppler compensation",
      body: "Confirm orbitops_doppler_residual_hz is within ±500 Hz; high residual amplifies SNR loss.",
    },
    {
      step: 3,
      title: "Inspect link-adaptation configuration",
      body: "Check that modcod is set to switch to a more robust profile when SNR drops below 8 dB.",
    },
  ],
  risk_if_ignored:
    "Continued packet loss on the affected beam, escalating to full link drop once SNR < 4 dB.",
  confidence: 0.78,
  unknowns: [
    "Whether RF interference (vs pointing error) is the dominant cause.",
    "Whether the next pass will reproduce the issue at the same elevation.",
  ],
  status: "ok",
  refusal_reason: null,
  error: null,
};

export const MOCK_COPILOT_REFUSED: CopilotResponse = {
  summary: null,
  likely_cause: null,
  evidence: {
    metrics_used: [],
    logs_used: [],
    scenario_id: null,
    time_window_seconds: null,
    timestamp: "2026-04-30T12:01:30Z",
  },
  recommended_actions: [],
  risk_if_ignored: null,
  confidence: 0,
  unknowns: [],
  status: "REFUSED",
  refusal_reason: "Question is outside the OrbitOps NTN domain.",
  error: null,
};

export const MOCK_COPILOT_INSUFFICIENT: CopilotResponse = {
  summary: null,
  likely_cause: null,
  evidence: {
    metrics_used: [],
    logs_used: [],
    scenario_id: null,
    time_window_seconds: null,
    timestamp: "2026-04-30T12:01:30Z",
  },
  recommended_actions: [],
  risk_if_ignored: null,
  confidence: 0,
  unknowns: ["No metrics or logs were retrieved for this query."],
  status: "INSUFFICIENT_EVIDENCE",
  refusal_reason: null,
  error: null,
};
