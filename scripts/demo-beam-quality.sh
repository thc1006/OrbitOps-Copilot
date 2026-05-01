#!/usr/bin/env bash
# scripts/demo-beam-quality.sh
#
# UC1 — Beam Quality Copilot end-to-end demo (Sprint 1 vertical slice VS-1).
# Starts ntn-metrics-emulator + copilot-api on local ports, drives them
# through the canonical beam-degradation scenario, prints the grounded answer,
# and validates AC-001 invariants. Tears down on EXIT.
#
# Usage:
#   make bootstrap                # one-time: create .venv + install deps
#   .venv/bin/pip install -e services/ntn-metrics-emulator services/copilot-api
#   ./scripts/demo-beam-quality.sh
#
# Override ports if 8000/8001 are taken:
#   EMU_PORT=18000 COP_PORT=18001 ./scripts/demo-beam-quality.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EMU_PORT="${EMU_PORT:-8000}"
COP_PORT="${COP_PORT:-8001}"
EMU_URL="http://127.0.0.1:${EMU_PORT}"
COP_URL="http://127.0.0.1:${COP_PORT}"

# ANSI helpers
G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; X=$'\e[0m'
say()  { printf "${B}── %s ──${X}\n" "$*"; }
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
warn() { printf "${Y}  ●${X} %s\n" "$*"; }
die()  { printf "${R}  ✗${X} %s\n" "$*" >&2; exit 1; }

cleanup() {
  if [[ -n "${EMU_PID:-}" ]]; then kill "$EMU_PID" 2>/dev/null || true; fi
  if [[ -n "${COP_PID:-}" ]]; then kill "$COP_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

# ── 0. preflight ──────────────────────────────────────────────────────────
say "preflight"
[[ -x .venv/bin/uvicorn ]] || die "run \`make bootstrap\` first (.venv/bin/uvicorn missing)"
command -v jq >/dev/null   || die "jq required (apt install jq / brew install jq)"
command -v curl >/dev/null || die "curl required"
[[ -f packages/scenarios/beam-degradation.json ]] || \
  die "missing packages/scenarios/beam-degradation.json — run 'python -m scenario_generator generate --scenario beam-degradation --seed 42 --out packages/scenarios/beam-degradation.json'"
ok "venv + jq + curl + scenario file present"

# ── 1. start emulator ─────────────────────────────────────────────────────
say "1. starting ntn-metrics-emulator on :${EMU_PORT}"
.venv/bin/uvicorn ntn_metrics_emulator.main:app \
  --host 127.0.0.1 --port "$EMU_PORT" --log-level error \
  >/tmp/orbitops-emulator.log 2>&1 &
EMU_PID=$!

# ── 2. start copilot pointing at the emulator ─────────────────────────────
say "2. starting copilot-api on :${COP_PORT} (ORBITOPS_EMULATOR_METRICS_URL=${EMU_URL}/metrics)"
ORBITOPS_EMULATOR_METRICS_URL="${EMU_URL}/metrics" \
  .venv/bin/uvicorn copilot_api.main:app \
  --host 127.0.0.1 --port "$COP_PORT" --log-level error \
  >/tmp/orbitops-copilot.log 2>&1 &
COP_PID=$!

# ── 3. wait for healthz on both ───────────────────────────────────────────
say "3. waiting for /healthz on both services"
for url in "${EMU_URL}/healthz" "${COP_URL}/healthz"; do
  for _ in $(seq 50); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "healthy: $url"
      break
    fi
    sleep 0.1
  done
done

# ── 4. load scenario ──────────────────────────────────────────────────────
say "4. loading beam-degradation scenario into emulator"
LOAD_RESP=$(curl -fsS -X POST "${EMU_URL}/scenario/load" \
  -H 'content-type: application/json' \
  --data @packages/scenarios/beam-degradation.json)
echo "$LOAD_RESP" | jq
SCENARIO_ID=$(echo "$LOAD_RESP" | jq -r .loaded)
[[ "$SCENARIO_ID" == "beam-degradation-001" ]] || die "unexpected scenario_id=$SCENARIO_ID"
ok "loaded ${SCENARIO_ID}"

# ── 5. tick to t=90 (mid-anomaly window: event at t=60..150) ─────────────
say "5. ticking simulated time +90s (snr_drop event active)"
TICK_RESP=$(curl -fsS -X POST "${EMU_URL}/scenario/tick" \
  -H 'content-type: application/json' -d '{"seconds":90}')
echo "$TICK_RESP" | jq
ACTIVE=$(echo "$TICK_RESP" | jq -r '.active_anomalies[0] // "none"')
[[ "$ACTIVE" == "snr_drop" ]] || warn "expected active anomaly snr_drop; got $ACTIVE"

# ── 6. quick peek at /metrics (filtered) ──────────────────────────────────
say "6. peeking at /metrics for orbitops_beam_snr_db"
curl -fsS "${EMU_URL}/metrics" | grep -E '^orbitops_beam_snr_db' | sed 's/^/    /'

# ── 7. ask the copilot in natural language ────────────────────────────────
say "7. asking copilot: \"Which beam is degrading and why?\""
ANSWER=$(curl -fsS -X POST "${COP_URL}/ask" \
  -H 'content-type: application/json' \
  -d '{
    "question":"Which beam is degrading and why?",
    "scenario_id":"beam-degradation-001",
    "time_window_seconds":60
  }')

echo
say "grounded answer (filtered)"
echo "$ANSWER" | jq '{
  status,
  summary,
  likely_cause,
  confidence,
  recommended_actions: [.recommended_actions[] | {step, title}],
  evidence: {
    metrics_used: [.evidence.metrics_used[] | {name, labels, value}],
    scenario_id: .evidence.scenario_id,
    time_window_seconds: .evidence.time_window_seconds
  },
  unknowns
}'

# ── 8. validate AC-001 invariants ────────────────────────────────────────
say "8. AC-001 invariant checks"

STATUS=$(echo "$ANSWER" | jq -r .status)
[[ "$STATUS" == "ok" ]] && ok "status == ok" || die "status=$STATUS (expected ok)"

SUMMARY=$(echo "$ANSWER" | jq -r '.summary // ""' | tr '[:upper:]' '[:lower:]')
[[ "$SUMMARY" == *"beam-1"* ]] && ok "summary cites beam-1" || die "summary missing beam-1: $SUMMARY"
[[ "$SUMMARY" == *"snr"* ]]    && ok "summary cites SNR"    || die "summary missing SNR: $SUMMARY"

SNR_VALUES=$(echo "$ANSWER" | jq -r '.evidence.metrics_used[] | select(.name=="orbitops_beam_snr_db") | .value')
[[ -n "$SNR_VALUES" ]] && ok "evidence cites orbitops_beam_snr_db = ${SNR_VALUES}" || die "no orbitops_beam_snr_db in evidence"
LOW_VALUES=$(echo "$SNR_VALUES" | awk '$1 < 8 {print}')
[[ -n "$LOW_VALUES" ]] && ok "≥1 SNR citation < 8 dB (AC-001 threshold)" || die "no SNR < 8 dB"

CONF=$(echo "$ANSWER" | jq -r .confidence)
ok "confidence=${CONF} (expected ≈ 0.78 from FakeLLMProvider)"

ACTIONS=$(echo "$ANSWER" | jq -r '.recommended_actions | length')
[[ "$ACTIONS" -ge 1 ]] && ok "recommended_actions=${ACTIONS}" || die "no recommended_actions"

echo
printf "${G}── demo complete ──${X}\n"
printf "  emulator log:  /tmp/orbitops-emulator.log\n"
printf "  copilot log:   /tmp/orbitops-copilot.log\n"
