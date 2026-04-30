#!/usr/bin/env bash
# package-zip.sh — emit orbitops-copilot.zip (excludes venv/node_modules/.git/tmp).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/.."

OUT="orbitops-copilot.zip"
[ -f "$OUT" ] && rm -f "$OUT"

zip -r "$OUT" orbitops-copilot \
  -x "orbitops-copilot/.git/*" \
  -x "orbitops-copilot/.venv/*" \
  -x "orbitops-copilot/venv/*" \
  -x "orbitops-copilot/node_modules/*" \
  -x "orbitops-copilot/dist/*" \
  -x "orbitops-copilot/build/*" \
  -x "orbitops-copilot/tmp/*" \
  -x "orbitops-copilot/**/__pycache__/*" \
  -x "orbitops-copilot/**/.pytest_cache/*" \
  -x "orbitops-copilot/**/.ruff_cache/*" \
  -x "orbitops-copilot/.env" \
  -x "orbitops-copilot/.env.local" \
  -x "orbitops-copilot/.claude/settings.local.json" \
  -x "orbitops-copilot/.claude/CLAUDE.local.md" \
  >/dev/null

echo "[package-zip] $OUT created at $(pwd)/$OUT ($(du -h "$OUT" | awk '{print $1}'))"
