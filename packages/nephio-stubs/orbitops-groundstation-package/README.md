# orbitops-groundstation-package (kpt stub)

A skeleton kpt package representing one OrbitOps ground-station deployment in Nephio R5 idiom.

## Real Nephio CRDs to wire (P2)

- `infra.nephio.org/v1alpha1/OCloud Registration`
- `o2ims.provisioning.oran.org/v1alpha1/ProvisioningRequest`
- `workload.nephio.org/v1alpha1/NetworkInstance`

These names are pre-standard; verify with current Nephio R5 catalog before pinning.

## How to use (Sprint 3+)

```bash
kpt pkg get https://github.com/<your-fork>/orbitops-copilot/packages/nephio-stubs/orbitops-groundstation-package
kpt fn render
kpt live init
kpt live apply
```
