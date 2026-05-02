#!/usr/bin/env bash
# tests/unit/test_check_tdd_discipline.sh
#
# Smoke test for scripts/check-tdd-discipline.sh — covers the six
# behaviorally-distinct paths the script gates on:
#   1. Branch with a `red(SPEC-NNN):` commit                 → exit 0 (blocking)
#   2. Branch w/o red, touching services/foo/src/bar.py      → exit 1 (blocking)
#   3. Branch w/o red, only touching docs/                   → exit 0 (blocking, out-of-scope)
#   4. Branch w/o red, touching services/, with [skip-tdd]   → exit 0 (blocking, escape hatch)
#   5. Advisory mode against any state                       → exit 0 always
#   6. conftest.py-only branch (pytest infra, not prod code) → exit 0 (out-of-scope)
#
# Without these, a typo or regex mistake in the script could silently flip
# the gate's polarity and either let bad PRs through or block legitimate
# work — caught only by a future CI failure.
#
# Runs in /tmp via `git init` so the repo state under test is isolated
# from the actual project. No network, no real refs.

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/scripts/check-tdd-discipline.sh"
[[ -x "$SCRIPT" ]] || { echo "FAIL: script missing or non-executable: $SCRIPT"; exit 1; }

TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"' EXIT

pass=0; fail=0
case_n=0
report_pass() { pass=$((pass + 1)); printf "  \e[32m✓\e[0m %s\n" "$1"; }
report_fail() { fail=$((fail + 1)); printf "  \e[31m✗\e[0m %s — %s\n" "$1" "$2"; }

setup_repo() {
  local dir="$TMPROOT/case-$1"
  mkdir -p "$dir"
  cd "$dir"
  git init -q -b main
  git config user.email "test@example.invalid"
  git config user.name "Test Runner"
  mkdir -p services/foo/src services/foo/tests docs
  echo "init" > docs/README.md
  git add docs/README.md
  git commit -q -m "init"
  git checkout -q -b feat/test
  cd "$dir"
}

run_script() {
  # Returns the script's exit code via $?.
  BRANCH=feat/test BASE=main "$SCRIPT" "$@" >/dev/null 2>&1
}

# ─── Case 1: red commit present → blocking pass ───
case_n=1
setup_repo "$case_n"
echo "x" > services/foo/tests/test_x.py
git add services/foo/tests/test_x.py
git commit -q -m "red(SPEC-001): add failing test for x"
echo "y" > services/foo/src/x.py
git add services/foo/src/x.py
git commit -q -m "green(SPEC-001): implement x"
if run_script --mode=blocking; then report_pass "case 1: red+green branch passes blocking gate"
else report_fail "case 1: red+green" "exit non-zero"; fi

# ─── Case 2: production code change w/o red → blocking fail ───
case_n=2
setup_repo "$case_n"
echo "z" > services/foo/src/z.py
git add services/foo/src/z.py
git commit -q -m "feat: add z without test"
if run_script --mode=blocking; then report_fail "case 2: missing-red prod change" "should have failed but passed"
else report_pass "case 2: missing-red prod change fails blocking gate"; fi

# ─── Case 3: docs-only w/o red → blocking pass (out of scope) ───
case_n=3
setup_repo "$case_n"
echo "more docs" >> docs/README.md
git add docs/README.md
git commit -q -m "docs: clarify"
if run_script --mode=blocking; then report_pass "case 3: docs-only branch is out of scope"
else report_fail "case 3: docs-only" "should pass; out-of-scope filter regression"; fi

# ─── Case 4: prod change + [skip-tdd] escape → blocking pass with warn ───
case_n=4
setup_repo "$case_n"
echo "u" > services/foo/src/u.py
git add services/foo/src/u.py
git commit -q -m "feat: dependency bump [skip-tdd] no behavior change"
if run_script --mode=blocking; then report_pass "case 4: [skip-tdd] hatch lets prod-change pass"
else report_fail "case 4: [skip-tdd]" "escape hatch ignored"; fi

# ─── Case 5: advisory mode never blocks ───
case_n=5
setup_repo "$case_n"
echo "v" > services/foo/src/v.py
git add services/foo/src/v.py
git commit -q -m "feat: no test on advisory mode"
if run_script --mode=advisory; then report_pass "case 5: advisory mode never blocks"
else report_fail "case 5: advisory" "advisory mode wrongly returned non-zero"; fi

# ─── Case 6: conftest.py-only branch is out of scope ───
# Strict /review on PR #49 found that `services/foo/conftest.py` (NOT
# under tests/) was previously matching the in-scope `services/*.py`
# pattern. conftest.py is pytest fixture infra, not production code,
# so a branch that only touches conftest.py must NOT be blocked.
case_n=6
setup_repo "$case_n"
echo "import pytest" > services/foo/conftest.py
git add services/foo/conftest.py
git commit -q -m "refactor: tighten pytest fixture in conftest"
if run_script --mode=blocking; then report_pass "case 6: conftest.py-only is out of scope"
else report_fail "case 6: conftest.py" "blocked when it shouldn't (pytest infra)"; fi

cd /

echo
echo "Summary: ${pass} pass, ${fail} fail"
[[ $fail -eq 0 ]] || exit 1
