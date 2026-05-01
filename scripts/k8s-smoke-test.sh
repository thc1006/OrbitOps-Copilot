#!/usr/bin/env bash
# scripts/k8s-smoke-test.sh
#
# Two modes:
#   1. Static (default; runs in CI without a cluster):
#        - validate manifests with `kubectl apply --dry-run=client`
#        - validate with kubeconform if available; fall back gracefully otherwise
#   2. Live (--live): asserts pods Ready + services exist + /healthz reachable.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="static"
[[ "${1:-}" == "--live" ]] && MODE="live"

G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; X=$'\e[0m'
say()  { printf "${B}── %s ──${X}\n" "$*"; }
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
warn() { printf "${Y}  ●${X} %s\n" "$*"; }
die()  { printf "${R}  ✗${X} %s\n" "$*" >&2; exit 1; }

# ── static (always) ───────────────────────────────────────────────
# Design: this gate must work *without a kubernetes cluster* (CI runner
# has none). `kubectl apply --dry-run=client` (kubectl 1.35.x) needs the
# apiserver for resource-type recognition even with `--validate=false`.
#   - kustomize build       : rendering correctness (always required)
#   - python yaml.safe_load : YAML structural integrity (always required)
#   - kubeconform           : schema validation (recommended; warn if missing)
#   - kubectl --dry-run     : opt-in extra check IFF a cluster is reachable
say "static: kustomize build"
command -v kustomize >/dev/null || die "missing kustomize"
TMP_RENDER=$(mktemp)
trap 'rm -f "$TMP_RENDER"' EXIT
kustomize build --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/local > "$TMP_RENDER"
ok "kustomize rendered $(wc -l < "$TMP_RENDER") lines"

say "static: yaml.safe_load_all"
command -v python3 >/dev/null 2>&1 \
  || die "missing python3 (run 'make bootstrap' to provision a project venv)"
python3 -c "import yaml" >/dev/null 2>&1 \
  || die "missing python module: pyyaml (pip install pyyaml, or run 'make bootstrap')"
python3 -c "import yaml,sys; list(yaml.safe_load_all(open(sys.argv[1])))" "$TMP_RENDER"
ok "all rendered docs parse as YAML"

if command -v kubeconform >/dev/null 2>&1; then
  say "static: kubeconform schema validation"
  kubeconform -strict -summary "$TMP_RENDER"
  ok "kubeconform clean"
else
  warn "kubeconform not installed; install for stricter schema checks"
fi

# Optional kubectl dry-run — only if a cluster is reachable. Catches a few
# extra schema errors the offline tools miss but cannot be required in CI
# where no cluster exists.
if command -v kubectl >/dev/null 2>&1 \
   && kubectl version --request-timeout=2s >/dev/null 2>&1; then
  say "static: kubectl --dry-run=client (cluster reachable)"
  kubectl apply --dry-run=client -f "$TMP_RENDER" >/dev/null
  ok "kubectl --dry-run accepted"
fi

# ── manifest invariants ───────────────────────────────────────────
# Reuses TMP_RENDER from above (was previously re-rendered, wasting cycles
# AND clobbering the trap registration).
say "static: manifest invariants"

python3 - "$TMP_RENDER" <<'PY'
import sys, yaml
with open(sys.argv[1]) as f:
    docs = list(yaml.safe_load_all(f))
deployments = [d for d in docs if d and d.get("kind") == "Deployment"]
fail = 0
for d in deployments:
    name = d["metadata"]["name"]
    for c in d["spec"]["template"]["spec"]["containers"]:
        if "resources" not in c or "requests" not in c["resources"] or "limits" not in c["resources"]:
            print(f"  X {name}: container {c['name']} missing resources requests/limits", file=sys.stderr); fail += 1
        for probe in ("livenessProbe", "readinessProbe"):
            if probe not in c:
                print(f"  X {name}: container {c['name']} missing {probe}", file=sys.stderr); fail += 1
        tag = c["image"].rsplit(":", 1)[-1] if ":" in c["image"] else "latest"
        if tag == "latest":
            print(f"  X {name}: image {c['image']} pinned to :latest (forbidden)", file=sys.stderr); fail += 1
print(f"  inspected {len(deployments)} Deployment(s)")
sys.exit(1 if fail else 0)
PY
ok "every Deployment has requests+limits+probes and pinned image tag"

if [[ "$MODE" == "static" ]]; then
  say "summary"
  ok "static smoke test passed (run with --live for cluster checks)"
  exit 0
fi

# ── live (require cluster) ────────────────────────────────────────
say "live: kubectl context"
ctx=$(kubectl config current-context 2>/dev/null || true)
[[ -n "$ctx" ]] || die "no kubectl context (run scripts/k8s-up.sh first)"
ok "context: $ctx"

say "live: namespace orbitops"
kubectl get ns orbitops >/dev/null 2>&1 || die "namespace 'orbitops' not found"
ok "namespace exists"

say "live: services"
for svc in ntn-metrics-emulator copilot-api digital-twin-ui; do
  kubectl -n orbitops get svc "$svc" >/dev/null 2>&1 || die "service $svc missing"
  ok "service $svc"
done

say "live: pods Ready"
kubectl -n orbitops wait --for=condition=Ready pod \
  -l app.kubernetes.io/part-of=orbitops-copilot --timeout=60s
ok "all orbitops pods Ready"

say "live: in-cluster /healthz probes"
for s in ntn-metrics-emulator:8000 copilot-api:8001; do
  pod=$(kubectl -n orbitops get pods -l app.kubernetes.io/name="${s%%:*}" \
        -o jsonpath='{.items[0].metadata.name}')
  kubectl -n orbitops exec "$pod" -- python3 -c \
    "import urllib.request,sys; r=urllib.request.urlopen('http://localhost:${s##*:}/healthz').read().decode(); sys.exit(0 if 'ok' in r else 1)" \
    || die "/healthz not 'ok' on $s"
  ok "$s /healthz returned ok"
done

say "summary"
ok "live smoke test passed"
