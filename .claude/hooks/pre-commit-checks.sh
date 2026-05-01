#!/usr/bin/env bash
# pre-commit-checks.sh — PreToolUse hook on Bash, fires only on `git commit`.
#
# Three sequential gates (any failure = hard block):
#   1. Staged .env / .env.local / etc. detection (catches missed gitignore).
#   2. scripts/check-no-secrets.sh --staged (anonymity + AKID + key headers).
#   3. Quick unit tests for affected services (Python only; bounded scope).
#
# Per CLAUDE.md §6 + §11: "Pre-commit hook 通過（含 scripts/check-no-secrets.sh）"
# is part of the Definition of Done.
#
# Exits:
#   0  — allow `git commit` to run
#   2  — hard block; stderr explains
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null || echo "")
[ -z "$command" ] && exit 0

# Match `git commit` invocations with proper word boundaries.
# Excludes:
#   - help/version forms (--help, -h, --version) — they don't create commits
#   - plumbing aliases (git commit-tree, git commit-graph)
if ! printf '%s' "$command" \
     | grep -qE '(^|[;&|[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi
case "$command" in
  *"--help"*|*" -h "*|*" -h"|*"--version"*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Capture the staged file list ONCE, NUL-delimited, into a bash array.
# Bare `for f in $(git diff …)` IFS-splits on whitespace and would shred
# filenames containing spaces / tabs / newlines.
staged=()
while IFS= read -r -d '' f; do
  [ -z "$f" ] && continue
  staged+=("$f")
done < <(git diff --cached --name-only -z --diff-filter=ACM 2>/dev/null || true)

# ─── 1. .env staging guard ─────────────────────────────
for f in "${staged[@]:-}"; do
  [ -z "$f" ] && continue
  case "$(basename "$f")" in
    .env|.env.local|.env.production|.env.staging|.env.development|.env.test)
      cat >&2 <<EOF
hook[pre-commit-checks]: BLOCK — staged file contains secrets:
  $f

Run:
  git rm --cached '$f'
  echo '$(basename "$f")' >> .gitignore   # if not already ignored
EOF
      exit 2
      ;;
  esac
done

# ─── 2. Secrets / anonymity scan on staged files ───────
# Hard requirement — the script lives in the repo, so its absence is a
# project-corruption signal, not a "graceful skip". Match verify.sh
# behaviour (it `fail`s on missing secrets gate).
if [ ! -x scripts/check-no-secrets.sh ]; then
  cat >&2 <<EOF
hook[pre-commit-checks]: BLOCK — scripts/check-no-secrets.sh missing or not executable.
  This script is required for the pre-commit secrets gate. Restore it
  (it's tracked in git) or run \`chmod +x scripts/check-no-secrets.sh\`.
EOF
  exit 2
fi
scan_out=$(scripts/check-no-secrets.sh --staged 2>&1) || {
  cat >&2 <<EOF
hook[pre-commit-checks]: BLOCK — secrets/anonymity scan failed.
$scan_out
Fix the leak(s) or update scripts/check-no-secrets.sh patterns and re-stage.
EOF
  exit 2
}

# ─── 3. Quick unit tests for affected Python services ───
py_changed=$(printf '%s\n' "${staged[@]:-}" \
  | grep -E '^services/[^/]+/(src|tests)/.*\.py$' \
  | head -50 \
  || true)

if [ -n "$py_changed" ]; then
  if [ -x .venv/bin/pytest ]; then
    pytest_bin=.venv/bin/pytest
  elif command -v pytest >/dev/null 2>&1; then
    pytest_bin=pytest
  else
    pytest_bin=""
  fi

  if [ -n "$pytest_bin" ]; then
    # Map each changed file to its service dir.
    declare -A dirty_svcs
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      svc=$(printf '%s' "$f" | cut -d/ -f2)
      dirty_svcs[$svc]=1
    done <<<"$py_changed"

    for svc in "${!dirty_svcs[@]}"; do
      tests_dir="services/$svc/tests"
      [ -d "$tests_dir" ] || continue
      if ! out=$("$pytest_bin" "$tests_dir" -q --no-header --color=no 2>&1); then
        cat >&2 <<EOF
hook[pre-commit-checks]: BLOCK — unit tests failed in $tests_dir:
$(printf '%s\n' "$out" | tail -30)

Fix the failing tests or run \`pytest $tests_dir\` interactively.
EOF
        exit 2
      fi
    done
  fi
fi

exit 0
