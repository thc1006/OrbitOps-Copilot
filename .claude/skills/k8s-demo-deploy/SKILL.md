---
name: k8s-demo-deploy
description: Build / iterate the kind / k3d / Kustomize / Helm demo deployment. Use for any change under deploy/ or packages/nephio-stubs/.
---

## Overview

Cloud-native deploy workflow. Sprint-0 supports `kustomize build | kubectl apply --dry-run=client`; Sprint-1+ adds real apply with kind. Helm chart skeleton already in place under `deploy/helm/orbitops-copilot/`. Nephio per ADR-005 is **stub-only**.

## Triggers

- Editing `deploy/k8s/`, `deploy/helm/`, `deploy/kind/`, `deploy/k3d/`, `deploy/docker-compose.yml`, `packages/nephio-stubs/`.
- Slash command `/implement SPEC-006` or `/demo`.
- Sprint-1 task S1-09 (kind smoke) or S1-08 (compose).

## Inputs

- `docs/specs/SPEC-006-k8s-deployment.md`
- `docs/adr/ADR-005-nephio-stub-first.md`
- Existing `deploy/` files and `Makefile` targets `kind-up` / `k8s-apply` / `k8s-smoke`.

## Step-by-step workflow

1. Edit Kustomize base / overlay or Helm template.
2. Always set: image tag ≠ `:latest`, `resources.requests/limits`, `livenessProbe`, `readinessProbe`.
3. **Dry-run first**: `kustomize build deploy/k8s/overlays/local | kubectl apply --dry-run=client -f -`.
4. **Helm template**: `helm template orbitops deploy/helm/orbitops-copilot/ > /tmp/helm-rendered.yaml && kubectl apply --dry-run=client -f /tmp/helm-rendered.yaml`.
5. **kind smoke** (Sprint-1+): `make kind-up && make k8s-apply && wait_pods_ready && curl healthz_via_port_forward && make kind-down`.
6. Update `tests/k8s-smoke/` with the smoke script (when Sprint 1 lands).
7. Re-run `./verify.sh` — gate 5 must pass.

## Output format

A modified Kustomize / Helm chart that renders cleanly and (Sprint-1+) deploys cleanly to kind. PR body includes the rendered diff snippet.

## Verification checklist

- [ ] `kustomize build` exits 0 with no deprecation warnings.
- [ ] `kubectl apply --dry-run=client` exits 0.
- [ ] `helm template` exits 0 (Sprint-1+).
- [ ] No `:latest` image tags.
- [ ] Each Deployment has both probes + resource limits.
- [ ] Nephio package is **stub** (no claim of full O2 IMS lifecycle).
- [ ] `./verify.sh` 6/6.

## Common failure modes

- Adding a Service of type `NodePort` exposed publicly.
- Missing `imagePullSecrets` for private registries (P1 task; not P0).
- Helm template variable typo silently producing empty values.
- Forgetting to bump chart `version` after a values change.

## Forbidden actions

- `kubectl delete` / `helm uninstall` against any non-`orbitops` namespace.
- Pushing images to public registries.
- Pretending a Nephio O2 IMS lifecycle works (it's a stub per ADR-005).
- Adding cloud-provider-specific resources without an explicit overlay.
