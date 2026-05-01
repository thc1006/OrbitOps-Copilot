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
  # v2 schema (post-ADR-007): top-level summary/likely_cause/recommended_actions/
  # confidence/unknowns/status; evidence has no confidence field; no answer/runbook.
  cat >tmp/demo-output.json <<EOF
{
  "status": "INSUFFICIENT_EVIDENCE",
  "summary": null,
  "likely_cause": null,
  "evidence": {
    "metrics_used": [],
    "logs_used": [],
    "scenario_id": null,
    "time_window_seconds": null,
    "timestamp": "2026-04-30T00:00:00Z"
  },
  "recommended_actions": [],
  "risk_if_ignored": null,
  "confidence": 0.0,
  "unknowns": ["Sprint 0 placeholder: services not yet running. Start with 'make dev-up'."],
  "refusal_reason": null,
  "error": "Sprint 0: services not yet implemented (S1-02..S1-05)."
}
EOF
  # Verify the placeholder JSON validates against the v2 schema (AC-004).
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 -c "import json,sys; from jsonschema import validate; \
        s = json.load(open('tests/contracts/copilot-response.schema.json')); \
        d = json.load(open('tmp/demo-output.json')); \
        validate(d, s)" 2>&1; then
      echo "[demo] WARN: placeholder JSON did not validate against schema"
    fi
  fi
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
