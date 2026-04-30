# Nephio stubs

> Per **ADR-005**: this directory provides a **kpt package skeleton** demonstrating Nephio R5 GitOps idioms for an OrbitOps ground-station deployment. It is **not** a fully functional Porch / O2 IMS / FOCOM lifecycle.

## Why a stub

- Full Nephio R5 environment requires management cluster + workload cluster + Porch + ConfigSync/ArgoCD + O-Cloud Manager.
- For a 7–14 day MVP that is impractical.
- The stub:
  - aligns naming with R5 conventions (`OCloud Registration`, `ProvisioningRequest`)
  - provides a `Kptfile` so `kpt pkg ... ` and `kpt fn ...` can be exercised
  - is structurally consumable by a real management cluster in Sprint 3+ (P2)

## Layout

```
nephio-stubs/
├── README.md
└── orbitops-groundstation-package/
    ├── Kptfile
    ├── README.md
    └── package-context.yaml
```

## Pre-standard caveat

Nephio's O2 IMS / FOCOM integration is itself **pre-standard** (Nephio R5 docs explicitly state this). Do not represent these stubs as O-RAN-conformant.

## Verify before install

- Nephio R5 release notes: <https://docs.nephio.org/docs/release-notes/r5/>
- kpt: <https://kpt.dev/> (verify CLI version with `kpt version`)
- Catalog tags: `git ls-remote --tags https://github.com/nephio-project/catalog`
