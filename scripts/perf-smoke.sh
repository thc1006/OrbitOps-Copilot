#!/usr/bin/env bash
# perf-smoke.sh — VS-20 SLO smoke gate
#
# Runs three k6 scenarios against live services and asserts 2× regression
# thresholds derived from the 2026-07-02 measured baselines.
#
# Usage:
#   ./scripts/perf-smoke.sh
#   COPILOT_BASE=http://copilot:8000 EMULATOR_BASE=http://emulator:8001 ./scripts/perf-smoke.sh
#
# Environment:
#   COPILOT_BASE    Base URL for copilot-api  (default: http://localhost:30081)
#   EMULATOR_BASE   Base URL for ntn-metrics-emulator (default: http://localhost:30080)
#
# Exit codes:
#   0 — all scenarios passed
#   1 — one or more scenarios breached their threshold
#
# Note: /ask is tested with JWT_REQUIRED=false (perf-only bypass).
#       In production with JWT enabled, /ask latency will be higher by the
#       JWKS verification cost (~1ms local, ~5-50ms remote IdP).
set -euo pipefail

COPILOT_BASE="${COPILOT_BASE:-http://localhost:30081}"
EMULATOR_BASE="${EMULATOR_BASE:-http://localhost:30080}"
RESULTS_DIR="${RESULTS_DIR:-tests/perf/results}"
K6="${K6:-k6}"

info()  { echo "[perf-smoke] INFO: $*" >&2; }
warn()  { echo "[perf-smoke] WARN: $*" >&2; }
fail()  { echo "[perf-smoke] FAIL: $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESULTS_DIR="${REPO_ROOT}/${RESULTS_DIR}"

mkdir -p "${RESULTS_DIR}"

# --- health checks -----------------------------------------------------------
info "Health-checking ${EMULATOR_BASE}/healthz ..."
curl --silent --fail --max-time 5 "${EMULATOR_BASE}/healthz" >/dev/null 2>&1 \
  || fail "emulator not reachable at ${EMULATOR_BASE} — start it first"

info "Health-checking ${COPILOT_BASE}/healthz ..."
curl --silent --fail --max-time 5 "${COPILOT_BASE}/healthz" >/dev/null 2>&1 \
  || fail "copilot-api not reachable at ${COPILOT_BASE} — start it first"

# --- scenario runner ---------------------------------------------------------
FAILED=0

run_scenario() {
  local label="$1"
  local script="$2"
  local summary_out="$3"
  shift 3
  # remaining args are passed to k6 (e.g., -e KEY=VALUE)
  info "Running ${label} ..."
  JWT_REQUIRED=false "${K6}" run \
    "${REPO_ROOT}/${script}" \
    --summary-trend-stats="med,p(95),p(99)" \
    --summary-export="${summary_out}" \
    --quiet \
    "$@" || {
      warn "${label}: one or more thresholds breached"
      FAILED=$((FAILED + 1))
    }
}

run_scenario \
  "emulator /metrics (100 RPS × 30s)" \
  "tests/perf/emulator-metrics.js" \
  "${RESULTS_DIR}/emulator-metrics-summary.json" \
  -e "EMULATOR_BASE=${EMULATOR_BASE}"

run_scenario \
  "copilot /healthz (100 RPS × 30s)" \
  "tests/perf/copilot-healthz.js" \
  "${RESULTS_DIR}/copilot-healthz-summary.json" \
  -e "COPILOT_BASE=${COPILOT_BASE}"

run_scenario \
  "copilot /ask (5 RPS × 30s, JWT_REQUIRED=false)" \
  "tests/perf/copilot-ask.js" \
  "${RESULTS_DIR}/copilot-ask-summary.json" \
  -e "COPILOT_BASE=${COPILOT_BASE}"

# --- final verdict -----------------------------------------------------------
info "Results written to ${RESULTS_DIR}/"

if [[ "${FAILED}" -gt 0 ]]; then
  fail "${FAILED} scenario(s) breached SLO thresholds — see output above"
fi

info "All perf scenarios passed SLO thresholds."
