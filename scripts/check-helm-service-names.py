#!/usr/bin/env python3
"""scripts/check-helm-service-names.py — ADR-009 contract test.

Asserts that the set of Service `metadata.name` values rendered by the Helm
chart matches exactly the set of Service names defined in the Kustomize base.

Without this gate, a regression that re-introduced the
`{{ include "orbitops.fullname" . }}-<svc>` prefix on chart Services would
render fine, lint fine, and `helm install` cleanly — but silently break the
demo because the prom config + grafana datasource ConfigMaps in
`deploy/k8s/base/{prometheus,grafana}-configmap.yaml` hardcode bare-name
DNS targets (`ntn-metrics-emulator:8000`, `prometheus:9090`, etc.).

Runs in CI via verify.sh's 5b/5 helm gate. Local invocation:
    python3 scripts/check-helm-service-names.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
HELM_CHART = REPO_ROOT / "deploy/helm/orbitops-copilot"
KUSTOMIZE_BASE = REPO_ROOT / "deploy/k8s/base"


def helm_service_names() -> set[str]:
    """Render the chart and return the set of Service `metadata.name`."""
    result = subprocess.run(
        ["helm", "template", "verify-render", str(HELM_CHART)],
        capture_output=True,
        text=True,
        check=True,
    )
    names: set[str] = set()
    for doc in yaml.safe_load_all(result.stdout):
        if doc and doc.get("kind") == "Service":
            names.add(doc["metadata"]["name"])
    return names


def kustomize_service_names() -> set[str]:
    """Walk the Kustomize base and return the set of Service `metadata.name`.

    Kustomize splits some services across `*-service.yaml` (emulator, copilot)
    and inlines others into `*-deployment.yaml` (grafana, prometheus, ui).
    Walk every YAML file under the base to be source-shape-agnostic.
    """
    names: set[str] = set()
    for path in KUSTOMIZE_BASE.glob("*.yaml"):
        with path.open() as f:
            for doc in yaml.safe_load_all(f):
                if doc and doc.get("kind") == "Service":
                    names.add(doc["metadata"]["name"])
    return names


def main() -> int:
    helm_names = helm_service_names()
    kustomize_names = kustomize_service_names()

    if helm_names == kustomize_names:
        print(
            f"  ✓ ADR-009 contract: Helm chart and Kustomize agree on "
            f"{len(helm_names)} Service name(s): "
            f"{', '.join(sorted(helm_names))}"
        )
        return 0

    only_helm = helm_names - kustomize_names
    only_kustomize = kustomize_names - helm_names
    print("  ✗ ADR-009 contract violation: Helm chart Service names diverge from Kustomize.")
    if only_helm:
        print(f"     Only in Helm:      {sorted(only_helm)}")
    if only_kustomize:
        print(f"     Only in Kustomize: {sorted(only_kustomize)}")
    print("     Fix: align deploy/helm/orbitops-copilot/templates/<svc>.yaml")
    print("          Service `metadata.name` to bare names matching deploy/k8s/base/")
    print("          (do NOT use `{{ include \"orbitops.fullname\" . }}` on Service kinds).")
    print("     See docs/adr/ADR-009-helm-service-naming.md.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
