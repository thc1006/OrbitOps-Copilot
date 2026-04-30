#!/usr/bin/env bash
# install-deps.sh — install per-service deps. Sprint 1 task.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[install-deps] Sprint 0 placeholder. Service-level pyproject/package.json will land in Sprint 1."

# Sprint 1 will populate these:
# .venv/bin/pip install -e services/scenario-generator
# .venv/bin/pip install -e services/ntn-metrics-emulator
# .venv/bin/pip install -e services/copilot-api
# (cd services/digital-twin-ui && npm install)
