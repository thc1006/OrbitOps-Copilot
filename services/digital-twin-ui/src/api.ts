// Thin wrapper around copilot-api. If VITE_API_BASE_URL is unset, returns
// MOCK_COPILOT_OK so the UI is demo-stable without a running backend.

import type { CopilotResponse } from "./types";
import { MOCK_COPILOT_OK } from "./mocks";

const BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env
  .VITE_API_BASE_URL;

const DEFAULT_TIMEOUT_MS = 5_000;

export interface AskInput {
  question: string;
  scenario_id?: string;
  time_window_seconds?: number;
}

/**
 * ApiError unifies the failure shape the UI catches. Replaces ad-hoc
 * `(e as Error).message` casts at call sites and lets components
 * distinguish timeout / abort / HTTP failures from generic errors.
 */
export interface ApiError {
  kind: "timeout" | "abort" | "http" | "network";
  message: string;
  status?: number;
}

function buildErrorResponse(unknownsLine: string, errorLabel: string): CopilotResponse {
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
    unknowns: [unknownsLine],
    status: "ERROR",
    refusal_reason: null,
    error: errorLabel,
  };
}

export async function askCopilot(
  input: AskInput,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<CopilotResponse> {
  if (!BASE) return MOCK_COPILOT_OK;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  // Chain caller-provided abort signal so e.g. unmount cancels the fetch.
  if (options.signal) {
    if (options.signal.aborted) controller.abort("caller-abort");
    else options.signal.addEventListener("abort", () => controller.abort("caller-abort"));
  }

  try {
    const r = await fetch(`${BASE}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!r.ok) {
      return buildErrorResponse(
        `copilot-api returned HTTP ${r.status}`,
        `HTTP ${r.status}`,
      );
    }
    return (await r.json()) as CopilotResponse;
  } catch (err) {
    // AbortError surfaces as DOMException with name === "AbortError" in
    // browsers and as a plain Error with name "AbortError" under jsdom.
    const name = (err as { name?: string })?.name ?? "";
    if (name === "AbortError") {
      const reason = String(controller.signal.reason ?? "");
      if (reason === "timeout") {
        return buildErrorResponse(
          `copilot-api request timed out after ${timeoutMs}ms`,
          "TIMEOUT",
        );
      }
      return buildErrorResponse("copilot-api request was cancelled", "ABORTED");
    }
    return buildErrorResponse(
      `copilot-api unreachable: ${(err as Error).message ?? "unknown"}`,
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}
