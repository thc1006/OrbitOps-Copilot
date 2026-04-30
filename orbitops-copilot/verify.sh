#!/usr/bin/env bash
# verify.sh — local quality gate
#
# Runs the same checks as CI:
#   1. format / lint  (advisory in Sprint 0 — warns but does not block)
#   2. unit tests     (delegates to test.sh; blocking)
#   3. no-secrets scan                                     (blocking)
#   4. JSON schema validation (contracts + sample scenarios) (blocking)
#   5. k8s manifest validation (kustomize + kubectl --dry-run) (blocking when tools present)
#   6. anonymity / forbidden-strings check                 (blocking)
#
# Exits non-zero on any blocking failure. Lint findings in gate 1 are
# advisory (skeleton placeholders won't all be ruff-clean yet) and tighten
# to blocking once Sprint 1 lands real implementations.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# ─── ANSI helpers ───────────────────────────────────────
GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; BOLD="\033[1m"; RESET="\033[0m"
info()  { printf "${BOLD}[verify]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[verify warn]${RESET} %s\n" "$*"; }
fail()  { printf "${RED}[verify FAIL]${RESET} %s\n" "$*"; exit 1; }
ok()    { printf "${GREEN}[verify ok]${RESET}   %s\n" "$*"; }

# ─── 1. format / lint ───────────────────────────────────
info "1/6 format & lint (placeholder for Sprint 0)"
if command -v ruff >/dev/null 2>&1; then
  if ruff check services/ scripts/ tests/ 2>/dev/null; then
    ok "ruff clean"
  else
    warn "ruff reported issues (Sprint 0 placeholders may have none — run again after Sprint 1)"
  fi
else
  warn "ruff not installed; run 'make bootstrap'"
fi

# ─── 2. unit tests ──────────────────────────────────────
info "2/6 unit tests (graceful)"
./test.sh

# ─── 3. no-secrets scan ─────────────────────────────────
info "3/6 no-secrets scan"
if [ -x scripts/check-no-secrets.sh ]; then
  # First prove the gate is not a placebo (regression for Copilot R3 review
  # finding A: previous version silently passed even when leaks existed).
  scripts/check-no-secrets.sh --self-test
  scripts/check-no-secrets.sh
  ok "no secrets / no anonymity leaks detected"
else
  fail "scripts/check-no-secrets.sh missing or non-executable"
fi

# ─── 4. JSON schema validation ──────────────────────────
info "4/6 JSON schema validation (contracts + sample scenarios)"
if command -v python3 >/dev/null 2>&1; then
  python3 scripts/validate_schemas.py
  ok "schemas valid"
else
  fail "python3 required"
fi

# ─── 5. k8s manifest validation ─────────────────────────
info "5/6 k8s manifest validation"
if command -v kustomize >/dev/null 2>&1 && command -v kubectl >/dev/null 2>&1; then
  if [ -f deploy/k8s/overlays/local/kustomization.yaml ]; then
    kustomize build deploy/k8s/overlays/local | kubectl apply --dry-run=client -f - >/dev/null
    ok "kustomize + kubectl --dry-run passed"
  else
    warn "deploy/k8s/overlays/local/kustomization.yaml not yet present (Sprint 1 task)"
  fi
else
  warn "kustomize / kubectl not installed; skipping locally — CI installs them and will run this gate"
fi

# ─── 6. anonymity check ─────────────────────────────────
info "6/6 anonymity / forbidden-strings check"
# GitHub handle `thc1006` is allowed (CLAUDE.md §7); still block school /
# school-email local-part / school domain / personal gmail.
forbidden_pat="(NCTU|NYCU|NTU|NCKU|NTHU|NTUST|hctsai|hctsai1006|cs\\.nctu\\.edu\\.tw|@gmail\\.com)"
hits=$(grep -RIE -l "$forbidden_pat" \
  --include="*.md" --include="*.json" --include="*.yml" --include="*.yaml" \
  --include="*.py" --include="*.ts" --include="*.tsx" --include="*.js" \
  --exclude=package-lock.json --exclude=pnpm-lock.yaml --exclude=yarn.lock \
  --exclude-dir=.venv --exclude-dir=venv --exclude-dir=.git \
  --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude-dir=.pytest_cache \
  --exclude-dir=.ruff_cache --exclude-dir=dist --exclude-dir=build --exclude-dir=tmp \
  . 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "$hits" | sed 's/^/    /'
  fail "anonymity leak detected — see files above"
else
  ok "no forbidden strings detected"
fi

info "all checks passed"
