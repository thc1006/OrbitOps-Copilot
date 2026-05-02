#!/usr/bin/env bash
# scripts/check-tdd-discipline.sh
#
# TDD red→green commit-history audit per CLAUDE.md §12.2.
#
# Two modes:
#   --mode=advisory  (default; warn but exit 0 — used by verify.sh)
#   --mode=blocking  (exit 1 on missing red commit + production code touched
#                     + no escape hatch — used by CI's tdd-discipline job)
#
# verify.sh runs this advisory on every push (incl. legacy branches).
# CI's `tdd-discipline` job runs blocking on `pull_request` only. Closes
# docs/reviews/issues.md I-3 (was: "advisory only; CI does not fail").
#
# Scope filter (blocking mode only): production code = .py / .ts / .tsx
# under services/ that's not a test or README. Pure docs / CI / scripts /
# deploy / infra changes are out of scope (CLAUDE.md §12.2 binds tested
# behavior changes; not all repo activity).
#
# Escape hatch: a commit subject in the PR range containing `[skip-tdd]`
# bypasses the gate. Reserved for emergencies and edge cases the regex
# misses; prints a banner so reviewers can flag misuse.
#
# Usage:
#   ./scripts/check-tdd-discipline.sh                                  # advisory
#   BRANCH=feat/foo BASE=main ./scripts/check-tdd-discipline.sh        # advisory specific
#   BASE=origin/main ./scripts/check-tdd-discipline.sh --mode=blocking # CI invocation

set -euo pipefail

MODE="advisory"
for arg in "$@"; do
  case "$arg" in
    --mode=advisory) MODE="advisory" ;;
    --mode=blocking) MODE="blocking" ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "$0" | head -n -1 | sed 's/^# \?//'
      exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

BRANCH="${BRANCH:-$(git branch --show-current 2>/dev/null || echo HEAD)}"
BASE="${BASE:-main}"

G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; X=$'\e[0m'
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
warn() { printf "${Y}  ●${X} %s\n" "$*"; }
fail() { printf "${R}  ✗${X} %s\n" "$*" >&2; exit 1; }

# Skip in non-git contexts.
git rev-parse --git-dir >/dev/null 2>&1 || { ok "not in a git repo; skip"; exit 0; }

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  ok "base ref '$BASE' not found; skip"
  exit 0
fi

# CI checkout often gives detached HEAD or HEAD pointing to a temporary
# merge ref. Resolve to whatever commit-ish we should diff from BASE.
if [[ "$BRANCH" == "$BASE" || "$BRANCH" == "HEAD" || -z "$BRANCH" ]]; then
  if [[ -n "${GITHUB_SHA:-}" ]]; then
    BRANCH="$GITHUB_SHA"
  else
    ok "on $BASE; nothing to audit"
    exit 0
  fi
fi

mapfile -t COMMITS < <(git log --pretty='%H %s' "$BASE..$BRANCH" 2>/dev/null || true)
if [[ ${#COMMITS[@]} -eq 0 ]]; then
  ok "no commits ahead of $BASE; nothing to audit"
  exit 0
fi

count=${#COMMITS[@]}
red_count=0
escape_count=0

# Match commit messages starting with `red:` `red(SPEC-NNN):` `red ` `red[`
# or `test(...):` containing `fail`.
RED_RE='^red[[:space:]:(]'
TEST_FAIL_RE='^test\(.*\):.*fail'
ESCAPE_RE='\[skip-tdd\]'

for line in "${COMMITS[@]}"; do
  msg="${line#* }"
  if [[ "$msg" =~ $RED_RE ]] || [[ "$msg" =~ $TEST_FAIL_RE ]]; then
    red_count=$((red_count + 1))
  fi
  if [[ "$msg" =~ $ESCAPE_RE ]]; then
    escape_count=$((escape_count + 1))
  fi
done

# Scope filter: in blocking mode we only fail when at least one production
# source file changed. A "production source file" = .py / .ts / .tsx under
# services/ that is NOT a test (services/<svc>/tests/** or *.test.*) and
# NOT a README.
file_in_scope() {
  case "$1" in
    services/*/tests/*) return 1 ;;
    services/*/README.md) return 1 ;;
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|*_test.py) return 1 ;;
    services/*.py|services/**/*.py)    return 0 ;;
    services/*.ts|services/**/*.ts)    return 0 ;;
    services/*.tsx|services/**/*.tsx)  return 0 ;;
  esac
  # Fallback: any services/<svc>/(src|app)/... source file.
  case "$1" in
    services/*/src/*|services/*/app/*) return 0 ;;
  esac
  return 1
}

in_scope="no"
if [[ "$MODE" == "blocking" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if file_in_scope "$f"; then
      in_scope="yes"
      break
    fi
  done < <(git diff --name-only "$BASE..$BRANCH" 2>/dev/null)
fi

if (( red_count >= 1 )); then
  ok "TDD discipline: ${red_count} red commit(s) found in ${count} commits on $BRANCH (mode=$MODE)"
  exit 0
fi

if (( escape_count >= 1 )); then
  warn "TDD: 0 red commits but [skip-tdd] escape hatch present (${escape_count} commit(s)). Reviewer must verify use is justified."
  exit 0
fi

if [[ "$MODE" == "blocking" && "$in_scope" == "no" ]]; then
  ok "TDD discipline: ${count} commit(s) on $BRANCH; out of scope (no production code under services/ touched)"
  exit 0
fi

if [[ "$MODE" == "blocking" ]]; then
  fail "TDD discipline (BLOCKING): $count commit(s) on $BRANCH; 0 'red:'-tagged.
  CLAUDE.md §12.2 — failing tests must precede implementation in git history.
  Per docs/reviews/issues.md I-3, PRs that touch services/**/*.py|.ts|.tsx need
  ≥1 commit with subject matching ^red[(:] before the implementation commit.
  Fix: rebase to insert a 'red(SPEC-NNN):' commit, or add '[skip-tdd]' to a
  commit subject if the change genuinely doesn't warrant a test (justify in PR
  description; reviewers will challenge unjustified use)."
fi

# Advisory fallthrough.
warn "TDD: $count commit(s) on $BRANCH; 0 'red:'-tagged. CLAUDE.md §12.2 expects red→green visible in history."
warn "If TDD was followed in-session, consider future PRs ship two commits:"
warn "    1. red(SPEC-NNN): add failing test"
warn "    2. green(SPEC-NNN): implement"
warn "(advisory; PR-scope CI gate will block when production code is touched)"
exit 0
