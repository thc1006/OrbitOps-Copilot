#!/usr/bin/env bash
# scripts/k8s-down.sh — destroy the local kind cluster.

set -euo pipefail
CLUSTER_NAME="${CLUSTER_NAME:-orbitops}"

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  kind delete cluster --name "$CLUSTER_NAME"
  echo "kind cluster ${CLUSTER_NAME} deleted."
else
  echo "kind cluster ${CLUSTER_NAME} not found; nothing to do."
fi
