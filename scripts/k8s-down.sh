#!/usr/bin/env bash
# scripts/k8s-down.sh — tear down the OrbitOps namespace from the current
# kubectl context. Does NOT touch the cluster itself.
#
# Two paths:
#   - kind cluster: also offer to delete the kind cluster.
#   - any other cluster (containerd kubeadm etc.): only namespace teardown.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NS="${NS:-orbitops}"
CLUSTER_NAME="${CLUSTER_NAME:-orbitops}"

G=$'\e[32m'; Y=$'\e[33m'; B=$'\e[1m'; X=$'\e[0m'
say()  { printf "${B}── %s ──${X}\n" "$*"; }
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
warn() { printf "${Y}  ●${X} %s\n" "$*"; }

# ── delete orbitops namespace from current kubectl context ───────
# Print the context so an operator pointing at the wrong cluster sees it
# before deletion happens. Refuse to delete unless the operator confirms
# (interactively typing 'yes', or non-interactively setting CONFIRM_DELETE=1).
CTX="$(kubectl config current-context 2>/dev/null || echo unknown)"
say "current kubectl context: $CTX"

if ! kubectl get ns "$NS" >/dev/null 2>&1; then
  warn "namespace $NS not found; nothing to remove"
else
  say "namespace $NS exists in context $CTX"
  if [ "${CONFIRM_DELETE:-}" = "1" ]; then
    : # explicit env-var opt-in
  elif [ -t 0 ]; then
    printf "Delete namespace '%s' from context '%s'? Type 'yes' to proceed: " "$NS" "$CTX"
    read -r CONFIRMATION
    if [ "$CONFIRMATION" != "yes" ]; then
      warn "deletion cancelled"
      exit 1
    fi
  else
    warn "non-interactive shell — refusing to delete without CONFIRM_DELETE=1"
    warn "re-run as: CONFIRM_DELETE=1 $0"
    exit 1
  fi
  kubectl delete namespace "$NS" --wait=false
  ok "delete request submitted (kubernetes will finalise asynchronously)"
fi

# ── if kind, optionally delete the cluster too ───────────────────
if command -v kind >/dev/null 2>&1 \
   && kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  say "kind cluster ${CLUSTER_NAME} detected"
  if [ "${KIND_DELETE_CLUSTER:-}" = "1" ]; then
    kind delete cluster --name "$CLUSTER_NAME"
    ok "kind cluster deleted"
  else
    warn "kind cluster left running. To delete it: KIND_DELETE_CLUSTER=1 $0"
  fi
fi
