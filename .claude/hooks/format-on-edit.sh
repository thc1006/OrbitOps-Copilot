#!/usr/bin/env bash
# format-on-edit.sh — PostToolUse hook on Write|Edit|MultiEdit.
#
# Runs ruff format + ruff check --fix-only on edited Python files. Strictly
# advisory — never blocks (PostToolUse cannot block tool execution anyway,
# the tool already ran). Goal: keep the working tree formatter-clean so
# the verify gate doesn't flag style issues.
#
# Falls back silently if ruff isn't available (no warnings — postcondition
# scripts shouldn't be noisy).
#
# Exits: always 0.
set -euo pipefail

# Anchor cwd to the project root so relative `.venv/bin/ruff` and
# relative file paths resolve consistently regardless of where Claude
# launched the tool from.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

input=$(cat)
path=$(jq -r '.tool_input.file_path // empty' <<<"$input" 2>/dev/null || echo "")
[ -z "$path" ] && exit 0
[ -f "$path" ] || exit 0

case "$path" in
  *.py) ;;
  *) exit 0 ;;
esac

# Prefer venv ruff (version-pinned in services/*/pyproject.toml dev deps
# + CI workflow env RUFF_VERSION). System ruff is acceptable fallback.
if [ -x .venv/bin/ruff ]; then
  ruff_bin=.venv/bin/ruff
elif command -v ruff >/dev/null 2>&1; then
  ruff_bin=ruff
else
  exit 0
fi

"$ruff_bin" format "$path" >/dev/null 2>&1 || true
"$ruff_bin" check --fix-only "$path" >/dev/null 2>&1 || true
exit 0
