# Future — Nephio + O-RAN O2 IMS / FOCOM integration

> Roadmap document. Sprint 1 ships **stubs only** (per ADR-005). This file
> describes the concrete steps to upgrade the kpt stub into a real
> Porch-managed, O2 IMS-provisioned, FOCOM-discoverable ground-station
> deployment.
>
> Status: NOT STARTED. Do **not** claim any of these capabilities exist.

## Goals (post-Sprint-3 / post-RunSpace)

1. **Versioned packages**: every change to `packages/nephio-stubs/orbitops-groundstation-package/` becomes a `PackageRevision` in Porch, deployable to any registered workload cluster.
2. **Provisioning request lifecycle**: an O-RAN O2 IMS `ProvisioningRequest` CR is the single declarative entry point for "deploy a ground station like *this profile* on cluster *X*". Reconciler writes back status (Provisioning / Provisioned / Failed) plus a NodePort/LoadBalancer for the operator to reach `/healthz`, `/metrics`, and the Copilot UI.
3. **FOCOM inventory**: each `GroundStationProfile` becomes a FOCOM resource so SMO ↔ O-Cloud discovery is two-way. Decommissioning a station deletes the corresponding inventory record.
4. **Closed-loop**: a Copilot recommendation that needs a configuration change (e.g., "switch to backup gateway") can be expressed as a `ProvisioningRequest` patch, reviewed by a human, and reconciled by Porch.

## Phased plan

### Phase 1 — Real `kpt fn render` (low cost; weeks)

- Add a `Kptfile` mutator pipeline that injects `app.kubernetes.io/managed-by: nephio` labels on every emitted resource.
- Add a `Kptfile` validator that fails if the emitted manifests omit resources/probes — covers the same invariants as `scripts/k8s-smoke-test.sh`.
- Wire `kpt fn render` into `make verify` (currently absent because we don't want to require kpt as a dev dep).

Acceptance: `kpt pkg get && kpt fn render && kustomize build` all succeed offline.

### Phase 2 — Porch repository (medium cost; weeks)

- Stand up a management cluster (kind is enough for dev; a tiny Talos / k3s cluster for staging).
- Install Nephio R5: Porch + ConfigSync (or ArgoCD).
- Create a Porch `Repository` CR pointing at this repo.
- Treat `packages/nephio-stubs/orbitops-groundstation-package/` as a `PackageRevision` source. `kpt alpha rpkg` creates a draft from a tag; `Repository.spec.deployment` syncs the published revision to a workload cluster.

Acceptance: deploying a new ground station = creating a `PackageRevision` and approving it; deletion is symmetric. No kubectl commands by hand.

### Phase 3 — O2 IMS `ProvisioningRequest` (medium-high; sprints)

- Pick a reference implementation: O-RAN-SC `pti-o2`, OpenShift KNI `oran-o2ims`, or StarlingX. (See `docs/00_research_2026_04.md` §2.8 for current state.)
- Create a `ProvisioningRequest` CRD reconciler that:
  - reads `spec.provisioningRequestDescription.templateName: orbitops-groundstation`
  - reads `spec.provisioningRequestDescription.templateParameters` (= our `GroundStationProfile`)
  - looks up the workload cluster by `spec.oCloudId`
  - calls Porch to deploy the resolved package revision
  - writes back status conditions
- Validate against the JSON schema we already ship (`tests/contracts/groundstation-profile.schema.json`) — same contract from CR all the way down.

Acceptance: a single `ProvisioningRequest` `kubectl apply` brings up the full OrbitOps stack on a target cluster.

### Phase 4 — FOCOM inventory (high; sprints)

- Each `GroundStationProfile` reconciles into a FOCOM resource: `OCloudInfrastructureResource`. The SMO can `GET` the inventory via FOCOM's `r1` interface.
- Beam profiles map to FOCOM RAN function instances; gateway profiles to N3 / SBA endpoints.
- Decommission flow: deleting the `ProvisioningRequest` cascades through Porch deletion → workload cleanup → FOCOM deregistration.

Acceptance: `curl https://focom/r1/oclouds/<id>/resources` returns ground-station inventory matching the live deployments.

### Phase 5 — Closed-loop with Copilot (research; quarter+)

- Copilot's recommended actions become `ProvisioningRequestPatch` candidates.
- Human-in-the-loop: a UI button `Apply this action` opens a PR that adds a patch to the relevant package revision.
- Argo CD or Porch reconciles the patch automatically; the next emulator tick / pod-health probe verifies the action's effect.

This is research-grade and subject to RunSpace post-mortem priorities.

## Specs / sources we'll be reading

- Nephio R5 release notes — https://docs.nephio.org/docs/release-notes/r5/
- O-RAN.WG6.O2-IMS-INTERFACE specification (current as of `docs/00_research_2026_04.md` §2.8)
- O-RAN-SC `pti-o2` reference: https://docs.o-ran-sc.org/projects/o-ran-sc-pti-o2/
- OpenShift KNI `oran-o2ims`: https://github.com/openshift-kni/oran-o2ims
- 3GPP Rel-19 NTN regenerative payload (for naming alignment in `GroundStationProfile.beam_profiles[].band`)

## What we will NOT build

- A custom O2 IMS implementation. We pick an upstream reference and integrate.
- A custom FOCOM. Same.
- A SMO. We are an O-Cloud / NF, not a SMO.
- Anything that pretends to be conformance-tested. Conformance is Phase 6+.

## Anonymity note

All examples in this document use `gs-tw-01` (public TASA Hsinchu region designator) and standard Nephio / O-RAN terminology. No team / school / personal identifiers must appear when this future plan turns into reality.
