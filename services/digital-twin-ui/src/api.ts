// Thin client around the OrbitOps stack:
//   - VITE_COPILOT_BASE_URL  : copilot-api    (default http://localhost:30081)
//   - VITE_EMULATOR_BASE_URL : ntn-metrics-emulator (default http://localhost:30080)
//
// All paths can be overridden via env at build time. When unset, defaults
// match the Sprint-1 NodePort overlay so the UI works out-of-box on a
// local k8s cluster.

import type {
  BeamView,
  CopilotResponse,
  GatewayView,
  MetricsSnapshot,
  PromSample,
} from "./types";

const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;

// Resolve API hosts at runtime against the page's origin so the same
// production bundle works whether the browser came in via `localhost`,
// the cluster's node IP (e.g. 31.41.34.19), or a future ingress hostname.
// Override at build time with VITE_COPILOT_BASE_URL / VITE_EMULATOR_BASE_URL
// when serving behind a reverse proxy.
const protocol =
  typeof window !== "undefined" ? window.location.protocol : "http:";
const hostname =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

const COPILOT_BASE =
  env.VITE_COPILOT_BASE_URL ?? `${protocol}//${hostname}:30081`;
const EMULATOR_BASE =
  env.VITE_EMULATOR_BASE_URL ?? `${protocol}//${hostname}:30080`;
const PROMETHEUS_BASE =
  env.VITE_PROMETHEUS_BASE_URL ?? `${protocol}//${hostname}:30090`;
const GRAFANA_BASE =
  env.VITE_GRAFANA_BASE_URL ?? `${protocol}//${hostname}:30030`;

const DEFAULT_TIMEOUT_MS = 5_000;

// ─── Copilot Q&A ───────────────────────────────────────────────────────

export interface AskInput {
  question: string;
  scenario_id?: string;
  time_window_seconds?: number;
}

function buildErrorResponse(
  unknownsLine: string,
  errorLabel: string,
): CopilotResponse {
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  let onAbort: (() => void) | null = null;
  if (options.signal) {
    if (options.signal.aborted) controller.abort("caller-abort");
    else {
      onAbort = () => controller.abort("caller-abort");
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  try {
    const r = await fetch(`${COPILOT_BASE}/ask`, {
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
    const name = (err as { name?: string })?.name ?? "";
    if (name === "AbortError") {
      const reason = String(controller.signal.reason ?? "");
      if (reason === "timeout")
        return buildErrorResponse(
          `copilot-api request timed out after ${timeoutMs}ms`,
          "TIMEOUT",
        );
      return buildErrorResponse(
        "copilot-api request was cancelled",
        "ABORTED",
      );
    }
    return buildErrorResponse(
      `copilot-api unreachable: ${(err as Error).message ?? "unknown"}`,
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
    if (onAbort && options.signal) {
      options.signal.removeEventListener("abort", onAbort);
    }
  }
}

// ─── Scenario controls ─────────────────────────────────────────────────

export interface ScenarioCurrent {
  scenario_id: string | null;
  t: number;
  active_anomalies: string[];
}

export async function loadScenario(
  scenario: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ loaded: string; t: number; beams: number; gateways: number }> {
  const r = await fetch(`${EMULATOR_BASE}/scenario/load`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scenario),
    signal,
  });
  if (!r.ok) throw new Error(`scenario/load HTTP ${r.status}`);
  return r.json();
}

export async function tickScenario(
  seconds: number,
  signal?: AbortSignal,
): Promise<{ t: number; active_anomalies: string[] }> {
  const r = await fetch(`${EMULATOR_BASE}/scenario/tick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seconds }),
    signal,
  });
  if (!r.ok) throw new Error(`scenario/tick HTTP ${r.status}`);
  return r.json();
}

export async function fetchScenarioCurrent(
  signal?: AbortSignal,
): Promise<ScenarioCurrent> {
  try {
    const r = await fetch(`${EMULATOR_BASE}/scenario/current`, { signal });
    if (!r.ok) {
      return { scenario_id: null, t: 0, active_anomalies: [] };
    }
    return r.json();
  } catch {
    return { scenario_id: null, t: 0, active_anomalies: [] };
  }
}

// ─── /metrics scrape + parse ───────────────────────────────────────────

const METRIC_RE =
  /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\{([^}]*)\})?\s+(-?[0-9.eE+-]+)/;

/**
 * Parse Prometheus exposition text into structured samples.
 * Skips `# HELP` / `# TYPE` / blank lines. Tolerant of extra whitespace.
 */
export function parsePromText(text: string): PromSample[] {
  const out: PromSample[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const m = METRIC_RE.exec(line);
    if (!m) continue;
    const [, name, labelText, value] = m;
    const labels: Record<string, string> = {};
    if (labelText) {
      // labelText looks like:  beam_id="beam-1",zone="apac"
      const labelRe = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
      let lm: RegExpExecArray | null;
      while ((lm = labelRe.exec(labelText))) labels[lm[1]] = lm[2];
    }
    const v = Number(value);
    if (Number.isFinite(v)) out.push({ name, labels, value: v });
  }
  return out;
}

const SNR_DEGRADED_THRESHOLD = 8;

export function computeBeams(samples: PromSample[]): BeamView[] {
  const byBeam = new Map<string, Partial<BeamView>>();
  const get = (id: string) => {
    let b = byBeam.get(id);
    if (!b) {
      b = {
        beam_id: id,
        snr_db: NaN,
        sinr_db: NaN,
        latency_ms: NaN,
        packet_loss_ratio: NaN,
        doppler_residual_hz: NaN,
        handover_state: 0,
        elevation_deg: NaN,
      };
      byBeam.set(id, b);
    }
    return b;
  };

  for (const s of samples) {
    const id = s.labels.beam_id;
    if (!id) continue;
    switch (s.name) {
      case "orbitops_beam_snr_db":
        get(id).snr_db = s.value;
        break;
      case "orbitops_beam_sinr_db":
        get(id).sinr_db = s.value;
        break;
      case "orbitops_link_latency_ms":
        get(id).latency_ms = s.value;
        break;
      case "orbitops_packet_loss_ratio":
        get(id).packet_loss_ratio = s.value;
        break;
      case "orbitops_doppler_residual_hz":
        get(id).doppler_residual_hz = s.value;
        break;
      case "orbitops_handover_state":
        get(id).handover_state = (s.value as 0 | 1 | 2) ?? 0;
        break;
      case "orbitops_beam_elevation_deg":
        get(id).elevation_deg = s.value;
        break;
    }
  }

  return Array.from(byBeam.values()).map((b) => {
    const snr = b.snr_db ?? NaN;
    const ho = b.handover_state ?? 0;
    let health: BeamView["health"] = "ok";
    if (ho >= 2 || (Number.isFinite(snr) && snr < SNR_DEGRADED_THRESHOLD - 2))
      health = "crit";
    else if (Number.isFinite(snr) && snr < SNR_DEGRADED_THRESHOLD)
      health = "warn";
    return { ...(b as BeamView), health };
  });
}

function computeGateways(samples: PromSample[]): GatewayView[] {
  const byGw = new Map<string, GatewayView>();
  for (const s of samples) {
    const id = s.labels.gateway_id;
    if (!id) continue;
    let g = byGw.get(id);
    if (!g) {
      g = { gateway_id: id, available: true, load: null };
      byGw.set(id, g);
    }
    if (s.name === "orbitops_gateway_available") {
      g.available = s.value >= 0.5;
    } else if (s.name === "orbitops_gateway_load") {
      g.load = s.value;
    }
  }
  return Array.from(byGw.values());
}

export async function fetchMetricsSnapshot(
  signal?: AbortSignal,
): Promise<MetricsSnapshot> {
  const [r, current] = await Promise.all([
    fetch(`${EMULATOR_BASE}/metrics`, { signal }),
    fetchScenarioCurrent(signal),
  ]);
  if (!r.ok) throw new Error(`/metrics HTTP ${r.status}`);
  const text = await r.text();
  const samples = parsePromText(text);
  return {
    scenario_id: current.scenario_id ?? "(none)",
    t_seconds: current.t,
    beams: computeBeams(samples),
    gateways: computeGateways(samples),
    active_anomaly: current.active_anomalies[0] ?? null,
    active_anomalies: current.active_anomalies,
    scraped_at: new Date().toISOString(),
  };
}

export const env_ = {
  COPILOT_BASE,
  EMULATOR_BASE,
  PROMETHEUS_BASE,
  GRAFANA_BASE,
};
