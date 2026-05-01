// Thin wrapper around copilot-api. If VITE_API_BASE_URL is unset, returns
// MOCK_COPILOT_OK so the UI is demo-stable without a running backend.

import type { CopilotResponse } from "./types";
import { MOCK_COPILOT_OK } from "./mocks";

const BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env
  .VITE_API_BASE_URL;

export interface AskInput {
  question: string;
  scenario_id?: string;
  time_window_seconds?: number;
}

export async function askCopilot(input: AskInput): Promise<CopilotResponse> {
  if (!BASE) return MOCK_COPILOT_OK;
  const r = await fetch(`${BASE}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    return {
      summary: null,
      likely_cause: null,
      evidence: {
        metrics_used: [],
        logs_used: [],
        scenario_id: null,
        time_window_seconds: null,
        timestamp: new Date().toISOString(),
      },
      recommended_actions: [],
      risk_if_ignored: null,
      confidence: 0,
      unknowns: [`copilot-api returned HTTP ${r.status}`],
      status: "ERROR",
      refusal_reason: null,
      error: `HTTP ${r.status}`,
    };
  }
  return (await r.json()) as CopilotResponse;
}
