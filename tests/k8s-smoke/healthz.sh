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
# Required tools on PATH: kubectl, curl. Kubeconfig must point at the
# live cluster (kind / k3d / kubeadm). The script does NOT bootstrap
# the cluster itself; pair with `make kind-up && make k8s-apply` before
# invoking, or run after `kustomize build ... | kubectl apply -f -`.
#
# What's smoked:
#   - 5 application Deployments: ntn-metrics-emulator, copilot-api,
#     digital-twin-ui, prometheus, grafana
#   - 2 observability Deployments: loki, alloy (added Phase A 2026-05-03)
#   - /healthz on emulator (8000) + copilot (8001) + UI (80) via
#     `kubectl port-forward` to localhost. We deliberately don't `kubectl
#     exec` curl into pods because the distroless service images don't
#     ship a shell; port-forward is the lowest-common-denominator path.
#
# PR #63 review hardening (2026-05-04):
#   - explicit `command -v curl` preflight (was implicit)
#   - EXIT trap kills any background port-forward PID, so a failed
#     /healthz doesn't leak a port-forward when `set -e` aborts
#   - port-forward stderr captured to a temp log; on /healthz failure
#     the log is included in the error message (was discarded with
#     `2>&1 >/dev/null`, masking "address already in use" etc.)

set -euo pipefail

NS="${ORBITOPS_NS:-orbitops}"
TIMEOUT_S="${TIMEOUT_S:-90}"

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'
ok()    { printf "${GREEN}  ✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}  ●${RESET} %s\n" "$*"; }
fail()  { printf "${RED}  ✗${RESET} %s\n" "$*" >&2; exit 1; }

# Track every backgrounded port-forward PID + its stderr log path so
# the EXIT trap can clean both up regardless of how the script exits
# (success, /healthz fail, kubectl error, ctrl-c).
PF_PIDS=()
PF_LOGS=()

cleanup_port_forwards() {
  for pid in "${PF_PIDS[@]:-}"; do
    [[ -z "$pid" ]] && continue
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  for log in "${PF_LOGS[@]:-}"; do
    [[ -z "$log" ]] && continue
    rm -f "$log"
  done
}
trap cleanup_port_forwards EXIT

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

# Required tools preflight.
for tool in kubectl curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    fail "$tool not on PATH"
  fi
done

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
# Each forward runs in the background; cleanup_port_forwards (trap) kills
# any leftover PID even if we abort mid-iteration.
for d in "${!HEALTHZ_PORTS[@]}"; do
  port="${HEALTHZ_PORTS[$d]}"
  local_port="$((20000 + RANDOM % 1000))"
  pf_log="$(mktemp -t "orbitops-pf-${d}.XXXXXX")"
  PF_LOGS+=("$pf_log")
  kubectl -n "$NS" port-forward "deployment/$d" "${local_port}:${port}" >"$pf_log" 2>&1 &
  pf_pid=$!
  PF_PIDS+=("$pf_pid")
  # Give port-forward a moment to bind.
  sleep 2
  if ! curl -sf --max-time 5 "http://127.0.0.1:${local_port}/healthz" >/dev/null 2>&1; then
    pf_diag="(no port-forward output captured)"
    if [[ -s "$pf_log" ]]; then
      pf_diag="$(head -c 800 "$pf_log")"
    fi
    fail "deployment/$d /healthz did not respond 200 — port-forward log: $pf_diag"
  fi
  ok "deployment/$d /healthz 200"
done

ok "all OrbitOps deployments healthy in namespace '$NS'"
