#!/usr/bin/env bash
# scripts/k8s-up.sh — bring up local kind cluster + apply orbitops manifests.
#
# Prerequisites:
#   - docker
#   - kind (https://kind.sigs.k8s.io/)
#   - kubectl
#   - kustomize
#   - service Docker images already built locally:
#       (cd services/ntn-metrics-emulator && docker build -t orbitops/ntn-metrics-emulator:0.1.0-dev .)
#       (cd services/copilot-api && docker build -t orbitops/copilot-api:0.1.0-dev .)
#       (cd services/digital-twin-ui && npm install && npm run build && \
#         docker build -t orbitops/digital-twin-ui:0.1.0-dev -f - . <<EOF
#       FROM nginx:alpine
#       COPY dist /usr/share/nginx/html
#       EOF)
#
# Usage:
#   ./scripts/k8s-up.sh
#
# After: services exposed at http://localhost:{30080,30081,30073} on the host.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CLUSTER_NAME="${CLUSTER_NAME:-orbitops}"
G=$'\e[32m'; R=$'\e[31m'; B=$'\e[1m'; X=$'\e[0m'
say() { printf "${B}── %s ──${X}\n" "$*"; }
ok()  { printf "${G}  ✓${X} %s\n" "$*"; }
die() { printf "${R}  ✗${X} %s\n" "$*" >&2; exit 1; }

for cmd in kind kubectl kustomize; do
  command -v "$cmd" >/dev/null || die "missing required tool: $cmd"
done

say "1. ensure kind cluster ${CLUSTER_NAME}"
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  ok "cluster ${CLUSTER_NAME} already exists"
else
  kind create cluster --name "$CLUSTER_NAME" --config deploy/kind/cluster.yaml
  ok "kind cluster created"
fi

say "2. switch kubectl context"
kubectl config use-context "kind-${CLUSTER_NAME}"

say "3. load local images into kind (skip if missing — apply will use pull policy)"
for img in \
  orbitops/ntn-metrics-emulator:0.1.0-dev \
  orbitops/copilot-api:0.1.0-dev \
  orbitops/digital-twin-ui:0.1.0-dev; do
  if docker image inspect "$img" >/dev/null 2>&1; then
    kind load docker-image --name "$CLUSTER_NAME" "$img"
    ok "loaded $img"
  else
    printf "    (skipped: $img not built locally; build first to deploy)\n"
  fi
done

say "4. apply local overlay"
kustomize build deploy/k8s/overlays/local | kubectl apply -f -

say "5. wait for pods Ready (timeout 90s)"
kubectl -n orbitops wait --for=condition=Ready pod -l app.kubernetes.io/part-of=orbitops-copilot --timeout=90s || \
  printf "    (some pods not Ready in 90s — run scripts/k8s-smoke-test.sh to investigate)\n"

ok "cluster up. emulator: http://localhost:30080  copilot: http://localhost:30081  ui: http://localhost:30073"
