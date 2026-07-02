// Resolved base URLs for copilot-api and the OIDC issuer, computed at runtime
// against the page origin so one production bundle works from localhost, the
// cluster node IP (e.g. 31.41.34.19), or a future ingress hostname. Override
// via VITE_COPILOT_BASE_URL / VITE_OIDC_BASE_URL at build time.
//
// NOTE: the copilot request transport — bearer injection (AC-S003-VS19.11) and
// 401 → clear-token + redirect (AC-S003-VS19.12) — lives in
// src/api.ts::askCopilot, which is the path the app actually calls. This module
// intentionally exports *only* the base URLs consumed by Login.tsx and api.ts;
// an earlier axios instance here was never used to issue a request (dead code)
// and has been removed so the auth wiring has a single source of truth.

const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;

// Guard against jsdom's `about:blank` which produces an invalid protocol.
// In real browsers window.location.protocol is always "http:" or "https:".
const protocol =
  typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)
    ? window.location.protocol
    : "http:";
const hostname =
  typeof window !== "undefined" && window.location.hostname !== ""
    ? window.location.hostname
    : "localhost";

export const COPILOT_BASE =
  env.VITE_COPILOT_BASE_URL ?? `${protocol}//${hostname}:30081`;

// Default matches docker-compose's host mapping (host 19090 → container 9090);
// 9090 would collide with Prometheus (D4). Override with VITE_OIDC_BASE_URL for
// k8s port-forward (9091) or in-cluster access. NOTE: the browser OIDC login
// flow is deferred (D1/D3) — this base is only used by the Login OIDC form,
// which is not wired end-to-end yet; the dev access path is the dev-bypass button.
export const OIDC_BASE = env.VITE_OIDC_BASE_URL ?? "http://localhost:19090";
