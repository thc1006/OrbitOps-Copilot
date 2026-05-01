#!/usr/bin/env bash
# remind-verify.sh — Stop hook (fires at end of every Claude turn).
#
# If the working tree has uncommitted changes to source files
# (.py / .ts / .tsx / .sh / .yml / .yaml / .json / .toml), nudge the
# user to run `make verify` before pushing. Idempotent — uses git status,
# no sentinel files, no inter-hook state.
#
# Strictly advisory. Stop hooks cannot block.
#
# Exits: always 0.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Look for uncommitted source-file changes.
dirty=$(git status --porcelain 2>/dev/null \
  | grep -E '^.. .*\.(py|ts|tsx|sh|yml|yaml|json|toml)$' \
  | head -3 \
  || true)

if [ -n "$dirty" ]; then
  cat <<EOF
💡 hook[remind-verify]: source files modified — before pushing, run:
   ./verify.sh        (6 gates: lint / tests / secrets / schema / k8s / anonymity)
   or:  make verify
$(printf '%s\n' "$dirty" | sed 's/^/   /')
EOF
fi
exit 0
