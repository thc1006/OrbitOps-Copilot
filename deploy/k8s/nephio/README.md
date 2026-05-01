# `deploy/k8s/nephio/` — Porch Repository registration

This directory contains Nephio R5 / Porch-specific manifests used to
**register** the OrbitOps Copilot kpt packages with Porch on a cluster
that already has Porch installed.

## What is here

| File | Purpose |
| --- | --- |
| `repository.yaml` | `Repository` CR pointing Porch at `packages/nephio-stubs/` of this Git repo. After apply, Porch creates `PackageRevision` resources for each Kptfile-bearing subdir. |

## Prerequisites

The target cluster must have Porch running. Confirm:

```bash
kubectl get apiservices.apiregistration.k8s.io | grep porch
kubectl -n porch-system get pods
```

The user's local `cloudnative-dev-telco` cluster already satisfies this.

## Apply

```bash
kubectl apply -f deploy/k8s/nephio/repository.yaml
# Verify discovery:
kubectl get repositories.config.porch.kpt.dev -A
kubectl get packagerevisions -A
```

## Why this is **not** in `deploy/k8s/base/`

The `base/` Kustomize is the OrbitOps runtime stack (services + obs).
Porch / Nephio integration is a separate cluster-management concern with
different lifecycle and prerequisites. Mixing them in one Kustomize would
make the runtime stack fail to apply on clusters without Porch.

## Future (P2 — see `docs/future/nephio-o2ims-integration.md`)

The current cluster has **Porch only** (the package-management piece).
Full Nephio (R5+/R6+) adds the following on top, none of which is present
today and all of which is needed for the items below:

- `nephio.org` CRDs (`Workload`, `Capacity`, `NetworkFunction`, `NFDeploy`)
- `nephio-system` namespace + controllers
- Optional: WebUI, SMO bridge, O-RAN O2 IMS hooks

P2 follow-ups (require full Nephio install):

- `PackageVariantSet` for fan-out across multiple ground stations
- O-RAN O2 IMS `OCloud` / `ProvisioningRequest` integration
- FOCOM coordination
- Real downstream-cluster deploy via Nephio config sync

The Sprint 1 path stops at "Porch can discover the package"; nothing is
actually deployed via the package today.
