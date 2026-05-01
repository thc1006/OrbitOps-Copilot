#!/usr/bin/env bash
# package-zip.sh — emit orbitops-copilot.zip for RunSpace submission.
#
# After the repo flatten the project sits at the git repo root, no longer
# inside an orbitops-copilot/ subfolder. RunSpace expects the zip to unpack
# into a folder named `orbitops-copilot/`, so this script stages the tree
# under a wrapper directory at zip-time without re-introducing nesting on disk.
#
# Excludes venv / node_modules / caches / secrets / build artefacts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="orbitops-copilot.zip"
[ -f "$OUT" ] && rm -f "$OUT"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
WRAP="$STAGE/orbitops-copilot"
mkdir -p "$WRAP"

rsync -a \
  --exclude='.git/' \
  --exclude='.venv/' \
  --exclude='venv/' \
  --exclude='**/node_modules/' \
  --exclude='dist/' \
  --exclude='build/' \
  --exclude='tmp/' \
  --exclude='**/__pycache__/' \
  --exclude='**/.pytest_cache/' \
  --exclude='**/.ruff_cache/' \
  --exclude='**/.mypy_cache/' \
  --exclude='**/*.egg-info/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.*' \
  --include='.env.example' \
  --exclude='.claude/settings.local.json' \
  --exclude='.claude/CLAUDE.local.md' \
  --exclude="$OUT" \
  ./ "$WRAP/"

(cd "$STAGE" && zip -r -q "$ROOT/$OUT" orbitops-copilot)

echo "[package-zip] $OUT created at $ROOT/$OUT ($(du -h "$ROOT/$OUT" | awk '{print $1}'))"
