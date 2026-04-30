#!/usr/bin/env bash
# bootstrap.sh — set up Python venv + Node toolchain hint.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install ruff pytest jsonschema pyyaml httpx

if command -v node >/dev/null 2>&1; then
  echo "[bootstrap] node $(node --version) detected. UI deps will be installed by Sprint 1 task."
else
  echo "[bootstrap] WARN: node not installed. Install Node 20+ before Sprint 1 UI work."
fi

echo "[bootstrap] done. Activate: source .venv/bin/activate"
