#!/usr/bin/env bash
# scripts/check-tdd-discipline.sh
#
# Advisory audit of TDD red→green commit history per CLAUDE.md §12.2.
#
# Usage:
#   BRANCH=feat/foo BASE=main ./scripts/check-tdd-discipline.sh   # specific
#   ./scripts/check-tdd-discipline.sh                              # current branch vs main
#
# Exits 0 always; prints WARN lines so verify.sh can surface them without
# breaking CI for legacy branches that pre-date this discipline.

set -euo pipefail

BRANCH="${BRANCH:-$(git branch --show-current)}"
BASE="${BASE:-main}"

G=$'\e[32m'; Y=$'\e[33m'; X=$'\e[0m'
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
warn() { printf "${Y}  ●${X} %s\n" "$*"; }

# Skip in non-git contexts.
git rev-parse --git-dir >/dev/null 2>&1 || { ok "not in a git repo; skip"; exit 0; }

# If BASE doesn't exist, skip cleanly.
if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  ok "base ref '$BASE' not found; skip"
  exit 0
fi

if [[ "$BRANCH" == "$BASE" ]]; then
  ok "on $BASE; nothing to audit"
  exit 0
fi

mapfile -t COMMITS < <(git log --pretty='%H %s' "$BASE..$BRANCH" 2>/dev/null || true)
if [[ ${#COMMITS[@]} -eq 0 ]]; then
  ok "no commits ahead of $BASE; nothing to audit"
  exit 0
fi

count=${#COMMITS[@]}
red_count=0
# Match commit messages starting with `red:` `red(SPEC-NNN):` `red ` `red[`
# or `test(...):` containing `fail`. Plain bash =~ regex; keep it simple.
RED_RE='^red[[:space:]:(]'
TEST_FAIL_RE='^test\(.*\):.*fail'
for line in "${COMMITS[@]}"; do
  msg="${line#* }"
  if [[ "$msg" =~ $RED_RE ]] || [[ "$msg" =~ $TEST_FAIL_RE ]]; then
    red_count=$((red_count + 1))
  fi
done

if (( red_count >= 1 )); then
  ok "TDD discipline: ${red_count} red commit(s) found in ${count} commits on $BRANCH"
  exit 0
fi

warn "TDD: $count commit(s) on $BRANCH; 0 'red:'-tagged. CLAUDE.md §12.2 expects red→green visible in history."
warn "If TDD was followed in-session, consider future PRs ship two commits:"
warn "    1. red(SPEC-NNN): add failing test"
warn "    2. green(SPEC-NNN): implement"
warn "(advisory only; CI does not fail on this)"
exit 0
