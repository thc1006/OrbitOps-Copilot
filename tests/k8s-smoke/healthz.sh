#!/usr/bin/env bash
# tests/k8s-smoke/healthz.sh — Sprint-1 VS-6 acceptance test (closes I-8).
#
# Asserts that every OrbitOps deployment in the `orbitops` namespace
# reaches Ready within 90s and the in-cluster /healthz endpoints all
# return HTTP 200 (per AC-S006-2 and AC-S006-3).
#
# Usage:
#   ./tests/k8s-smoke/healthz.sh                       # default timeouts
#   ORBITOPS_NS=orbitops TIMEOUT_S=180 ./tests/k8s-smoke/healthz.sh
#
# Exit code:
#   0 → all deployments Ready + /healthz OK
#   1 → any deployment failed to reach Ready, or any /healthz != 200
#
# Required: kubectl on PATH, kubeconfig pointing at the live cluster
# (kind / k3d / kubeadm). The script does NOT bootstrap the cluster
# itself; pair with `make kind-up && make k8s-apply` before invoking,
# or run after `kustomize build ... | kubectl apply -f -`.
#
# What's smoked:
#   - 5 application Deployments: ntn-metrics-emulator, copilot-api,
#     digital-twin-ui, prometheus, grafana
#   - 2 observability Deployments: loki, alloy (added Phase A 2026-05-03)
#   - In-cluster /healthz on emulator (port 8000) + copilot (8001)
#     via `kubectl exec` from a transient curl-bearing pod (alloy
#     image carries no curl, but emulator + copilot images ship busybox
#     wget). For pods without wget we fall back to `kubectl port-forward`
#     which doesn't require an in-pod HTTP client.

set -euo pipefail

NS="${ORBITOPS_NS:-orbitops}"
TIMEOUT_S="${TIMEOUT_S:-90}"

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'
ok()    { printf "${GREEN}  ✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}  ●${RESET} %s\n" "$*"; }
fail()  { printf "${RED}  ✗${RESET} %s\n" "$*" >&2; exit 1; }

# All Deployments expected up. Includes the Phase A obs additions.
DEPLOYMENTS=(
  ntn-metrics-emulator
  copilot-api
  digital-twin-ui
  prometheus
  grafana
  loki
  alloy
)

# (deployment, container_port) pairs for the /healthz smoke. UI is an
# nginx image — its /healthz is served by nginx.conf (cheaper than
# index.html on every probe).
declare -A HEALTHZ_PORTS=(
  [ntn-metrics-emulator]=8000
  [copilot-api]=8001
  [digital-twin-ui]=80
)

if ! command -v kubectl >/dev/null 2>&1; then
  fail "kubectl not on PATH"
fi

if ! kubectl get ns "$NS" >/dev/null 2>&1; then
  fail "namespace '$NS' missing — run 'kustomize build ... | kubectl apply -f -' first"
fi

# 1. Wait for each Deployment to become Available within TIMEOUT_S.
for d in "${DEPLOYMENTS[@]}"; do
  if ! kubectl -n "$NS" rollout status "deployment/$d" --timeout="${TIMEOUT_S}s" >/dev/null 2>&1; then
    fail "deployment/$d did not reach Ready within ${TIMEOUT_S}s"
  fi
  ok "deployment/$d Ready"
done

# 2. /healthz smoke via port-forward (works regardless of in-pod tools).
# Runs each forward in the background, curls localhost, kills it.
for d in "${!HEALTHZ_PORTS[@]}"; do
  port="${HEALTHZ_PORTS[$d]}"
  local_port="$((20000 + RANDOM % 1000))"
  kubectl -n "$NS" port-forward "deployment/$d" "${local_port}:${port}" >/dev/null 2>&1 &
  pf_pid=$!
  # Give port-forward a moment to bind.
  sleep 2
  if ! curl -sf --max-time 5 "http://127.0.0.1:${local_port}/healthz" >/dev/null 2>&1; then
    kill "$pf_pid" 2>/dev/null || true
    wait "$pf_pid" 2>/dev/null || true
    fail "deployment/$d /healthz did not respond 200"
  fi
  kill "$pf_pid" 2>/dev/null || true
  wait "$pf_pid" 2>/dev/null || true
  ok "deployment/$d /healthz 200"
done

ok "all OrbitOps deployments healthy in namespace '$NS'"
