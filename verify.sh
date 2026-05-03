#!/usr/bin/env bash
# verify.sh — local quality gate
#
# Runs the same checks as CI:
#   1.  format / lint  (advisory in Sprint 0 — warns but does not block)
#   1b. TDD discipline audit — advisory locally; blocking variant runs in
#       CI's `tdd-discipline` job on pull_request only (PR #49)
#   1c. claims-audit marketing-word grep across docs/ (advisory)
#   2.  unit tests (delegates to test.sh; blocking)
#   3.  real-secrets scan (AKID / API keys / PEM headers)   (blocking)
#   3b. observability stack static check (Prom + Grafana provisioning)  (blocking)
#   3c. canonical scenario JSON ↔ UI mirror drift detector (blocking)
#   4.  JSON schema validation (contracts + sample scenarios) (blocking)
#   5.  k8s manifest validation (kustomize + kubeconform)   (blocking when tools present)
#   5b. helm chart validation (lint + template + ADR-009 service-name contract)
#       (added 2026-05-02 by PRs #47 + #48; blocking when helm present)
#
# Exits non-zero on any blocking failure. Lint findings in gate 1 are
# advisory (skeleton placeholders won't all be ruff-clean yet) and tighten
# to blocking once Sprint 1 lands real implementations.
#
# History note: gate 6 (anonymity / forbidden-strings) was removed on
# 2026-05-01 — real names are now allowed in repo per CLAUDE.md §2.1. The
# advisory 1c (anonymity author allowlist) was removed in the same change.
# (CLAUDE.md §7 now scopes anonymity to the submission archive only — that's
# a packaging-time concern, not a verify-time one.)

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
info "1/5 format & lint (placeholder for Sprint 0)"
if command -v ruff >/dev/null 2>&1; then
  if ruff check services/ scripts/ tests/ 2>/dev/null; then
    ok "ruff clean"
  else
    warn "ruff reported issues (Sprint 0 placeholders may have none — run again after Sprint 1)"
  fi
else
  warn "ruff not installed; run 'make bootstrap'"
fi

# ─── 1b. TDD discipline (advisory; per docs/reviews/tdd-audit.md I-3) ──
if [ -x scripts/check-tdd-discipline.sh ]; then
  scripts/check-tdd-discipline.sh
fi

# ─── 1c. claims audit (advisory; per docs/reviews/runspace-claims-audit.md I-10) ──
# (Was 1d before the 1c "anonymity author allowlist" gate was retired
# on 2026-05-01 alongside the project-wide anonymity relaxation.)
marketing=$(grep -rIlE '\b(seamless|seamlessly|production[ -]?ready|fully[ -]?integrated|enterprise[ -]?grade|state[ -]?of[ -]?the[ -]?art|industry[ -]?leading)\b' \
  --include='*.md' README.md docs/ 2>/dev/null | grep -v 'docs/reviews/' | grep -v 'docs/adr/' || true)
if [ -n "$marketing" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    printf "${YELLOW}[verify warn]${RESET} claims-audit: marketing word in %s — review per docs/reviews/runspace-claims-audit.md\n" "$f"
  done <<< "$marketing"
fi

# ─── 2. unit tests ──────────────────────────────────────
info "2/5 unit tests (graceful)"
./test.sh

# ─── 3. real-secrets scan ───────────────────────────────
info "3/5 real-secrets scan (AKID / API keys / PEM headers)"
if [ -x scripts/check-no-secrets.sh ]; then
  # First prove the gate is not a placebo (regression for Copilot R3 review
  # finding A: previous version silently passed even when leaks existed).
  scripts/check-no-secrets.sh --self-test
  scripts/check-no-secrets.sh
  ok "no real-secret leaks detected (AKID / OpenAI / Anthropic / GH-token / PEM)"
else
  fail "scripts/check-no-secrets.sh missing or non-executable"
fi

# ─── 3b. observability stack static check ───────────────
if [ -x scripts/check-observability.sh ]; then
  info "3b/5 observability stack static check"
  scripts/check-observability.sh >/dev/null
  ok "prometheus.yml + Grafana provisioning + dashboard panels valid"
fi

# ─── 3c. canonical scenario JSON ↔ UI mirror drift detector ────
# services/digital-twin-ui/src/scenarios/* is a tracked mirror of
# packages/scenarios/*. The mirror exists because vitest's test-mode
# resolver rejects cross-project-root imports. Canonical is source of
# truth; this gate fails loudly if the mirror drifts.
if command -v cmp >/dev/null 2>&1; then
  for canonical in packages/scenarios/*.json; do
    mirror="services/digital-twin-ui/src/scenarios/$(basename "$canonical")"
    if [ -f "$mirror" ] && ! cmp -s "$canonical" "$mirror"; then
      fail "scenario JSON drift: $canonical ≠ $mirror (cp '$canonical' '$mirror')"
    fi
  done
  ok "scenario JSON canonical/mirror in sync"
fi

# ─── 4. JSON schema validation ──────────────────────────
info "4/5 JSON schema validation (contracts + sample scenarios)"
if command -v python3 >/dev/null 2>&1; then
  python3 scripts/validate_schemas.py
  ok "schemas valid"
else
  fail "python3 required"
fi

# ─── 5. k8s manifest validation ─────────────────────────
# scripts/k8s-smoke-test.sh validates offline using kustomize + python
# yaml-parse + kubeconform-when-installed. kubectl is only used
# opportunistically (when a cluster is reachable).
#
# Required tools on PATH: kustomize, python3, PyYAML (the latter two via
# `make bootstrap` venv). kubeconform optional but recommended.
info "5/5 k8s manifest validation"
if command -v kustomize >/dev/null 2>&1; then
  if [ -x scripts/k8s-smoke-test.sh ]; then
    scripts/k8s-smoke-test.sh >/dev/null
    ok "k8s static smoke (manifests + invariants)"
  elif [ -f deploy/k8s/overlays/local/kustomization.yaml ]; then
    if command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" >/dev/null 2>&1; then
      kustomize build --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/local | python3 -c "import yaml,sys; list(yaml.safe_load_all(sys.stdin))"
      ok "kustomize render + yaml parse passed"
    else
      warn "python3 + pyyaml required for fallback yaml-parse — run 'make bootstrap'"
    fi
  else
    warn "deploy/k8s/overlays/local/kustomization.yaml not yet present"
  fi
else
  warn "kustomize not installed; skipping locally — CI installs it and will run this gate"
fi

# ─── 5b. Helm chart validation (added per PR #47 deep /review Tier C) ───
# Without this, future commits could break the chart and CI would stay green.
# Both `helm lint` and `helm template` are blocking when helm is on PATH.
if [ -d deploy/helm/orbitops-copilot ]; then
  if command -v helm >/dev/null 2>&1; then
    info "5b/5 helm chart validation (lint + template + ADR-009 service-name contract)"
    helm lint deploy/helm/orbitops-copilot >/dev/null
    helm template verify-render deploy/helm/orbitops-copilot >/dev/null
    # ADR-009 service-name contract — asserts Helm-rendered Service names
    # exactly match Kustomize Service names. A regression (re-adding the
    # release-fullname-prefix on Service kinds) renders/lints/installs fine
    # but silently breaks Prom scrape because ConfigMaps hard-code bare DNS.
    if command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" >/dev/null 2>&1; then
      python3 scripts/check-helm-service-names.py
    else
      warn "python3 + pyyaml required for ADR-009 service-name contract — skipping"
    fi
    ok "helm chart lint + template + ADR-009 contract pass"
  else
    warn "helm not installed; skipping locally — CI installs it and will run this gate"
  fi
fi

info "all checks passed"
