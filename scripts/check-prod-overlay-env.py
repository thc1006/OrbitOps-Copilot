#!/usr/bin/env python3
"""scripts/check-prod-overlay-env.py — I-13 contract test for prod overlay.

Asserts that `kustomize build deploy/k8s/overlays/prod` renders Grafana
env entries that match the security contract:

  - GF_SECURITY_ADMIN_USER       = "admin"             (unchanged from base)
  - GF_SECURITY_ADMIN_PASSWORD   ← secretKeyRef on Secret/orbitops-grafana-admin
  - GF_USERS_ALLOW_SIGN_UP       = "false"             (unchanged from base)
  - GF_AUTH_ANONYMOUS_ENABLED    = "false"             (overlay flips it off)
  - GF_AUTH_ANONYMOUS_ORG_ROLE   = "Viewer"            (must NOT be dropped)

Why this gate exists (PR #66 self-review follow-up, 2026-05-04):

The prod overlay's Grafana env patch is JSON6902 with hardcoded indices
(`/env/1/value`, `/env/3/value`). If a future PR reorders entries in
`deploy/k8s/base/grafana-deployment.yaml`, the overlay silently misapplies:
- `secretKeyRef` could land on the wrong env name (e.g. ALLOW_SIGN_UP)
- admin password stays as literal "admin" in production
- anonymous flag stays at "true"
…and `helm lint` / `kubectl apply --dry-run` won't catch any of it because
the YAML is structurally valid.

This contract test renders the overlay and asserts the actual env shape
matches the security intent, regardless of base-file index ordering.

Also asserts that the overlay does NOT render a Secret manifest for
`orbitops-grafana-admin` — the placeholder template must be operator-managed
out-of-band, not applied via `kubectl apply -k`.

Local invocation:
    python3 scripts/check-prod-overlay-env.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
PROD_OVERLAY = REPO_ROOT / "deploy/k8s/overlays/prod"

SECRET_NAME = "orbitops-grafana-admin"

# Env contract: every entry must match. Tuple = (name, expected_shape).
# `expected_shape` is one of:
#   {"value": "<literal>"}        → assert e["value"] == literal
#   {"valueFrom_secretKeyRef": (secret_name, key)}
#                                 → assert e["valueFrom"]["secretKeyRef"]
#                                          matches name + key
EXPECTED_ENV: list[tuple[str, dict[str, Any]]] = [
    ("GF_SECURITY_ADMIN_USER", {"value": "admin"}),
    (
        "GF_SECURITY_ADMIN_PASSWORD",
        {"valueFrom_secretKeyRef": (SECRET_NAME, "password")},
    ),
    ("GF_USERS_ALLOW_SIGN_UP", {"value": "false"}),
    ("GF_AUTH_ANONYMOUS_ENABLED", {"value": "false"}),
    ("GF_AUTH_ANONYMOUS_ORG_ROLE", {"value": "Viewer"}),
]


def render_overlay() -> list[dict[str, Any]]:
    """Run `kustomize build` on the prod overlay and return loaded docs."""
    result = subprocess.run(
        [
            "kustomize",
            "build",
            "--load-restrictor=LoadRestrictionsNone",
            str(PROD_OVERLAY),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return [d for d in yaml.safe_load_all(result.stdout) if d]


def find_grafana_env(docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for d in docs:
        if (
            d.get("kind") == "Deployment"
            and d.get("metadata", {}).get("name") == "grafana"
        ):
            return d["spec"]["template"]["spec"]["containers"][0]["env"]
    raise AssertionError("rendered overlay has no Deployment/grafana")


def assert_no_admin_secret_rendered(docs: list[dict[str, Any]]) -> None:
    matches = [
        d
        for d in docs
        if d.get("kind") == "Secret"
        and d.get("metadata", {}).get("name") == SECRET_NAME
    ]
    if matches:
        raise AssertionError(
            f"overlay renders {len(matches)} Secret/{SECRET_NAME} manifest(s); "
            "must be 0 — the template Secret is operator-managed out-of-band, "
            "not applied via kustomize. Re-check kustomization.yaml resources: "
            "list (PR #63 review feedback)."
        )


def assert_env_matches(env: list[dict[str, Any]]) -> None:
    by_name = {e["name"]: e for e in env}
    missing = [name for name, _ in EXPECTED_ENV if name not in by_name]
    if missing:
        raise AssertionError(
            f"Grafana env missing required keys after prod overlay: {missing}. "
            f"Got names: {list(by_name)}"
        )

    for name, shape in EXPECTED_ENV:
        entry = by_name[name]
        if "value" in shape:
            actual_value = entry.get("value")
            expected_value = shape["value"]
            if actual_value != expected_value:
                raise AssertionError(
                    f"env[{name}] expected value={expected_value!r}, "
                    f"got {entry!r}. (Likely the JSON6902 patch indices "
                    f"drifted out of sync with the base env order — see "
                    f"deploy/k8s/overlays/prod/kustomization.yaml comment.)"
                )
            if "valueFrom" in entry:
                raise AssertionError(
                    f"env[{name}] expected literal value, got valueFrom: {entry!r}"
                )
        elif "valueFrom_secretKeyRef" in shape:
            secret_name, key = shape["valueFrom_secretKeyRef"]
            vf = entry.get("valueFrom")
            if not vf or "secretKeyRef" not in vf:
                raise AssertionError(
                    f"env[{name}] expected valueFrom.secretKeyRef, got {entry!r}. "
                    f"(Likely the JSON6902 `add /env/N/valueFrom` patch indices "
                    f"drifted; admin password may still be literal in production.)"
                )
            ref = vf["secretKeyRef"]
            if ref.get("name") != secret_name or ref.get("key") != key:
                raise AssertionError(
                    f"env[{name}] expected secretKeyRef name={secret_name!r}/key={key!r}, "
                    f"got {ref!r}"
                )
            if "value" in entry:
                raise AssertionError(
                    f"env[{name}] expected secretKeyRef-only, got both value AND valueFrom: {entry!r}"
                )


def main() -> int:
    try:
        docs = render_overlay()
    except subprocess.CalledProcessError as exc:
        print(
            f"  ✗ kustomize build failed: {exc.stderr or exc.stdout}",
            file=sys.stderr,
        )
        return 1
    except FileNotFoundError:
        print("  ● kustomize not on PATH; skipping I-13 contract test", file=sys.stderr)
        return 0

    try:
        assert_no_admin_secret_rendered(docs)
        env = find_grafana_env(docs)
        assert_env_matches(env)
    except AssertionError as exc:
        print(f"  ✗ I-13 prod-overlay contract: {exc}", file=sys.stderr)
        return 1

    print(
        f"  ✓ I-13 prod-overlay env contract: {len(EXPECTED_ENV)} env entries match "
        "(secretKeyRef on admin password, anonymous=false, ORG_ROLE preserved); "
        "no placeholder Secret applied"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
