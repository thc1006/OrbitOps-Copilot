#!/usr/bin/env bash
# block-env-write.sh — PreToolUse hook on Write|Edit|MultiEdit.
#
# Refuses to write secret-bearing .env / .env.local / .env.production /
# .env.staging / .env.development / .env.test files. ALLOWS .env.example
# (the template). Per CLAUDE.md §6: ".env 永不入 git".
#
# Exits:
#   0  — allow tool execution
#   2  — hard block (Claude refuses the tool); stderr feeds the reason back.
#
# Input: JSON via stdin per Claude Code hooks contract.
set -euo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // empty' <<<"$input" 2>/dev/null || echo "")
[ -z "$path" ] && exit 0

base=$(basename "$path")

case "$base" in
  .env.example)
    # Templates are explicitly OK.
    exit 0
    ;;
  .env|.env.local|.env.production|.env.staging|.env.development|.env.test)
    cat >&2 <<EOF
hook[block-env-write]: refusing to write secret-bearing file:
  $path

Use .env.example for the committed template. Real .env values must stay
out of git per CLAUDE.md §6.
EOF
    exit 2
    ;;
  .env.*)
    cat >&2 <<EOF
hook[block-env-write]: refusing to write $path
  Path matches .env.* but is not the allowed template (.env.example).
  Either rename to .env.example (template) or write to a non-tracked
  location.
EOF
    exit 2
    ;;
esac

exit 0
