#!/usr/bin/env bash
# protect-critical-paths.sh — PreToolUse hook on Bash.
#
# Refuses to delete files under SDD/ADR/AC/contract directories. These are
# the project's contracts (per CLAUDE.md §12.1: "沒有 spec 不寫 code");
# accidentally rming them via `rm` / `git rm` would break the discipline.
#
# This hook ONLY catches deletion idioms. It does NOT block edits — those
# are legitimate (specs evolve). Genuine deletions should happen outside
# Claude Code as part of a deliberate SPEC/ADR retirement PR.
#
# Exits:
#   0 — allow
#   2 — hard block; stderr explains
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null || echo "")
[ -z "$command" ] && exit 0

# Detect deletion idioms with proper word boundaries. The earlier glob
# `*"rm "*` was a false-positive trap: `harm`, `term`, `parm`, `farm` all
# contain literal `rm ` as a substring. Use grep -E with start-of-line /
# punctuation / whitespace boundaries on both sides.
if ! printf '%s' "$command" \
     | grep -qE '(^|[;&|[:space:]])(rm|git[[:space:]]+rm)([[:space:]]|$)'; then
  exit 0
fi

PROTECTED=(
  "docs/specs/"
  "docs/adr/"
  "docs/acceptance/"
  "tests/contracts/"
  "CLAUDE.md"
  "AGENTS.md"
)

for p in "${PROTECTED[@]}"; do
  if grep -qF "$p" <<<"$command"; then
    cat >&2 <<EOF
hook[protect-critical-paths]: BLOCK — refusing to delete protected path:
  $p

This path is part of the SDD/ADR/AC/contract discipline (CLAUDE.md §12.1
"沒有 spec 不寫 code"). Removing it via Claude Code is forbidden.

If retirement is genuinely intended:
  1. Open an ADR documenting the decision.
  2. Run the rm command outside Claude Code in the same PR.
  3. Update any references that point at the removed file.
EOF
    exit 2
  fi
done

exit 0
