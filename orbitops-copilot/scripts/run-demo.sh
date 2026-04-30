#!/usr/bin/env bash
# run-demo.sh — end-to-end golden scenario demo (AC-004).
# Sprint 0 emits a friendly placeholder until Sprint 1 services land.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p tmp

EMU="${ORBITOPS_EMULATOR_BASE_URL:-http://localhost:8000}"
COP="${ORBITOPS_COPILOT_BASE_URL:-http://localhost:8001}"

echo "[demo] checking emulator and copilot health..."
if ! curl -fsS "$EMU/healthz" >/dev/null 2>&1; then
  echo "[demo] emulator not reachable at $EMU. Run 'make dev-up' first."
  echo "[demo] Sprint 0 placeholder: writing tmp/demo-output.json with INSUFFICIENT_EVIDENCE"
  cat >tmp/demo-output.json <<EOF
{
  "status": "INSUFFICIENT_EVIDENCE",
  "answer": null,
  "runbook": null,
  "evidence": {
    "metrics_used": [],
    "logs_used": [],
    "scenario_id": null,
    "timestamp": "2026-04-30T00:00:00Z",
    "confidence": 0.0
  },
  "error": "Sprint 0: services not yet implemented (S1-02..S1-05)."
}
EOF
  echo "[demo] tmp/demo-output.json written."
  exit 0
fi

# Sprint 1 will replace below with real curl chain:
# 1. POST /scenarios/load with packages/scenarios/beam-degradation.json
# 2. wait 60s
# 3. POST /ask "Which beam is degrading?"
# 4. POST /runbook
# 5. write tmp/demo-output.json

echo "[demo] real flow runs from Sprint 1 onwards (S1-10)."
