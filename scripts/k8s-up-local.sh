#!/usr/bin/env bash
# scripts/k8s-up-local.sh — full-stack k8s deploy for a local containerd
# kubeadm cluster (no kind, no docker shim).
#
# Pipeline:
#   1. docker build  → 3 service images (emulator, copilot-api, digital-twin-ui)
#   2. docker save   → tar each image
#   3. ctr import    → load the tar into containerd's `k8s.io` namespace
#                      (kubelet pulls images from this namespace by default)
#   4. kubectl apply → Kustomize build of overlays/local
#   5. wait for pods Ready (timeout 120s)
#
# Requires: docker, kubectl, kustomize, sudo (for ctr).
#
# Counterpart of scripts/k8s-up.sh (kind path) — pick whichever matches
# your cluster's container runtime.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# NS is hardcoded — the Kustomize overlay sets `namespace: orbitops` and the
# pod label `app.kubernetes.io/part-of=orbitops-copilot` is used to wait on
# Ready below. Letting the user override NS would silently desync.
NS=orbitops
TAG="${TAG:-0.1.0-dev}"

G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; X=$'\e[0m'
say()  { printf "${B}── %s ──${X}\n" "$*"; }
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
warn() { printf "${Y}  ●${X} %s\n" "$*"; }
die()  { printf "${R}  ✗${X} %s\n" "$*" >&2; exit 1; }

# ── Pre-flight ────────────────────────────────────────────
for cmd in docker kubectl kustomize ctr; do
  command -v "$cmd" >/dev/null 2>&1 || die "missing required tool: $cmd"
done
sudo -n true 2>/dev/null \
  || warn "sudo will prompt for password (needed for `ctr -n=k8s.io images import`)"

CTX="$(kubectl config current-context 2>/dev/null || true)"
[ -n "$CTX" ] || die "no kubectl context — point KUBECONFIG at your cluster first"
ok "kubectl context: $CTX"

# ── 1. docker build ──────────────────────────────────────
declare -A IMAGES=(
  ["orbitops/ntn-metrics-emulator:$TAG"]="services/ntn-metrics-emulator/Dockerfile"
  ["orbitops/copilot-api:$TAG"]="services/copilot-api/Dockerfile"
  ["orbitops/digital-twin-ui:$TAG"]="services/digital-twin-ui/Dockerfile"
)

say "1. docker build"
for image in "${!IMAGES[@]}"; do
  dockerfile="${IMAGES[$image]}"
  # Build context = repo root for all three (UI Dockerfile uses
  # services/digital-twin-ui/* paths; emulator Dockerfile already does too;
  # copilot-api Dockerfile uses services/copilot-api/* — verified).
  docker build -t "$image" -f "$dockerfile" . >/dev/null
  ok "built $image"
done

# ── 2. save + ctr import ─────────────────────────────────
say "2. import images into containerd k8s.io namespace"
TMP_TAR_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_TAR_DIR"' EXIT
for image in "${!IMAGES[@]}"; do
  safe_name="${image//[\/:]/_}"
  tar="$TMP_TAR_DIR/$safe_name.tar"
  docker save "$image" -o "$tar"
  sudo ctr -n=k8s.io images import "$tar" >/dev/null
  ok "imported $image"
done

# ── 3. kubectl apply ─────────────────────────────────────
say "3. kustomize build → kubectl apply"
kustomize build --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/local | kubectl apply -f -
ok "manifests applied to namespace $NS"

# ── 4. wait Ready ─────────────────────────────────────────
say "4. wait for pods Ready (timeout 120s)"
if kubectl -n "$NS" wait --for=condition=Ready pod \
   -l app.kubernetes.io/part-of=orbitops-copilot --timeout=120s; then
  ok "all orbitops pods Ready"
else
  warn "some pods not Ready — diagnose with:"
  printf "      kubectl -n %s get pods\n" "$NS"
  printf "      kubectl -n %s describe pod <name>\n" "$NS"
  printf "      kubectl -n %s logs <name>\n" "$NS"
  exit 1
fi

# ── 5. summary ────────────────────────────────────────────
say "summary"
NODE_IP="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')"
echo "  cluster context : $CTX"
echo "  namespace       : $NS"
echo
echo "  endpoints (NodePort on $NODE_IP):"
echo "    emulator   : http://${NODE_IP}:30080/healthz"
echo "    copilot    : http://${NODE_IP}:30081/healthz"
echo "    digital-ui : http://${NODE_IP}:30073/"
echo "    prometheus : http://${NODE_IP}:30090/"
echo "    grafana    : http://${NODE_IP}:30030/   (admin/admin; anon Viewer)"
echo
echo "  smoke test:"
echo "    scripts/k8s-smoke-test.sh --live"
