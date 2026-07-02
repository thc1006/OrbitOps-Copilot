# ADR-013 — Closed-Loop GitOps Apply Design (ArgoCD + Copilot Sidecar)

| 欄位 | 值 |
|---|---|
| Status | Proposed |
| Date | 2026-07-02 |
| Deciders | architect, k8s-platform-engineer |
| Sprint | Sprint-4 design; implementation Sprint-5+ |

## Context

The OrbitOps demo currently requires a human operator to run remediation steps manually after the copilot identifies an anomaly:

```
copilot /explain → operator reads output → operator runs kustomize + kubectl apply
```

This is adequate for the Sprint-0–3 sandbox but defeats the stated mission of an **operations digital twin**: the copilot should not merely explain anomalies but should be able to recommend — and optionally trigger — remediation actions in a controlled, auditable way.

Sprint-4 (VS-21) designs the pattern and ships a `dry_run` stub. Sprint-5+ implements the real closed-loop with ArgoCD. The design constraints are:

1. **GitOps source-of-truth must be respected**: no `kubectl apply` from the copilot process; all changes flow through Git + a GitOps controller.
2. **Separation of concerns**: copilot RECOMMENDS; a separate controller EXECUTES. This boundary is explicit in the `RecommendedAction` schema.
3. **Audit trail**: every triggered apply must be observable (Prometheus counter; ArgoCD app history).
4. **Blast-radius control**: the copilot has no cluster credentials. It cannot apply manifests directly even if compromised.
5. **Sprint-4 must be testable without ArgoCD**: the stub sidecar runs in `apply_mode="dry_run"` and only logs the action. This allows AC testing of the pattern before ArgoCD is wired.

## Decision

### Copilot output — `RecommendedAction` extension

The `/runbook` endpoint's JSON response gains two new optional fields on `RecommendedAction` (see ADR-004 Sprint-4 Extension):

```json
{
  "action_type": "gitops_apply",
  "target_manifest_path": "deploy/k8s/overlays/beam-recovery",
  "rollback_strategy": "argocd-rollback"
}
```

`action_type` values:

| Value | Meaning | Sprint available |
|---|---|---|
| `manual` | Operator reads and acts; no automated trigger | Sprint-0 default (all existing runbooks) |
| `dry_run` | Sidecar logs the action; no cluster change | Sprint-4 (stub) |
| `gitops_apply` | Sidecar triggers ArgoCD sync on `target_manifest_path` | Sprint-5+ |

The JSON schema (`tests/contracts/copilot-response.schema.json`) treats `action_type` and `target_manifest_path` as optional with a default of `manual`. Existing responses without these fields continue to validate.

### Sidecar controller design (stub in Sprint-4; real in Sprint-5)

A lightweight Python process (`services/gitops-controller/`) runs as a sidecar in the copilot-api Pod:

```
copilot-api  →  internal HTTP POST /actions  →  gitops-controller sidecar
                                                   ├── apply_mode=dry_run  → log only
                                                   └── apply_mode=live     → argocd app sync <app> --revision HEAD
```

The sidecar has no in-cluster kubeconfig. It calls the **ArgoCD API server** (`argocd.argocd.svc.cluster.local:443`) using a dedicated ArgoCD ServiceAccount token (cluster-scoped, `applications/sync` permission only, no `delete`).

Credentials flow:

```
Kubernetes Secret (argocd-sync-token)
  → mounted read-only in gitops-controller container
  → used only for argocd app sync calls
  → NOT accessible to copilot-api container (separate volumeMount)
```

### ArgoCD ApplicationSet + App of Apps

ArgoCD ApplicationSet pattern is used (per Nephio R5 reference):

- One root Application (`orbitops-root`) manages child Applications per overlay.
- Each child Application points to a Kustomize overlay in `deploy/k8s/overlays/<scenario>/`.
- The gitops-controller sidecar triggers `argocd app sync <child-app-name>` for the overlay named in `target_manifest_path`.

This means the copilot never pushes to Git directly — ArgoCD pulls from Git. The copilot only triggers a sync of an already-declared Application.

### Audit

Every action (including `dry_run` and failed `gitops_apply`) increments:

```
orbitops_gitops_applies_total{action_type="gitops_apply|dry_run|manual", outcome="success|failure|skipped"}
```

ArgoCD's own sync history provides the authoritative remediation audit trail. The Prometheus counter provides aggregation and alerting.

### Rollback

- `rollback_strategy: "argocd-rollback"` → sidecar calls `argocd app rollback <app> <revision>` on failure.
- Default rollback is the previous ArgoCD sync revision (one-step). Copilot does not choose the revision; ArgoCD owns that history.
- Sprint-4 stub: `rollback_strategy` field is emitted but the sidecar does not execute rollback in `dry_run` mode.

## Consequences

**Positive:**

- GitOps source-of-truth (Git) is respected. No out-of-band `kubectl apply` from any application process.
- ArgoCD's RBAC + sync history is the authoritative audit trail for all remediation actions. This satisfies any operator audit requirement without additional logging infrastructure.
- **Separation of concerns is enforced architecturally**: copilot-api has no cluster credentials. Even a fully compromised copilot-api container cannot apply or delete manifests without going through the sidecar, which itself is limited to ArgoCD `sync` on pre-declared Applications.
- `dry_run` mode allows the full Sprint-4 AC suite to be tested (and demonstrated) without an ArgoCD installation. Sprint-4 deliverables are self-contained.
- Decoupled from ArgoCD implementation: the sidecar HTTP interface (`POST /actions`) is stable; replacing ArgoCD with Flux in Sprint-6 requires only changing the sidecar internals, not the copilot-api or the schema.

**Negative:**

- Adds ArgoCD as a required cluster component for the live `gitops_apply` path. Sprint-4 sandbox continues to use direct `kustomize build | kubectl apply` for manual steps; the closed loop is not active until Sprint-5.
- The sidecar introduces a new failure mode: if the sidecar crashes or the ArgoCD API is unreachable, `gitops_apply` actions silently become no-ops unless the Prometheus counter alert fires.
- ArgoCD's `app sync` is not instantaneous; the copilot's runbook response is sent before the sync completes. The operator (or monitoring) must verify the outcome from ArgoCD's own UI or CLI.

**Mitigation:**

- Sprint-4 `apply_mode="dry_run"` prevents any blast radius until the full pattern is validated.
- Prometheus alert on `orbitops_gitops_applies_total{outcome="failure"} > 0` catches sidecar or ArgoCD failures immediately.
- The sidecar exposes `/healthz`; copilot-api startup probe checks sidecar health before advertising readiness in `live` mode.
- `rollback_strategy` field in every runbook ensures operators have a documented rollback path even when the automated path fails.

## Alternatives considered

1. **Flux (Flux CD)** — Viable. Flux's `Kustomization` CRD is semantically equivalent to ArgoCD's Application for our use case. Rejected for Sprint-4/5 because Nephio R5 reference architecture uses ArgoCD, and maintaining both in the demo cluster adds complexity. A Sprint-6 evaluation ADR is appropriate if Flux's image automation features are needed.

2. **Direct `kubectl apply` in copilot-api** — Rejected. This breaks GitOps (the cluster state diverges from Git) and is a privilege escalation risk (copilot-api would need `cluster-admin`-adjacent permissions). Any compromise of copilot-api would be a direct cluster compromise.

3. **GitHub Actions / external CI trigger** — Rejected for the closed-loop demo. Triggering a GHA workflow introduces internet dependency and an external credential (GH token with repo + workflow write). Incompatible with the air-gapped demo requirement (ADR-011).

4. **Manual-only runbook (no automation)** — Rejected. "Manual-only" is the Sprint-0–3 baseline. VS-21 exists specifically to design the automated path. A permanent manual-only decision would contradict the project mission statement ("operations digital twin").

5. **Operator Framework / KOPF custom operator** — Considered but deferred. An Operator that watches a custom `RemediationAction` CRD would be more Kubernetes-native than a sidecar calling the ArgoCD API. Deferred to Sprint-6+ because it adds CRD lifecycle management complexity before the basic closed-loop pattern is proven.

## Boundary clarification (P0 vs P2)

| Component | Sprint-4 state | Sprint-5+ state |
|---|---|---|
| `RecommendedAction.action_type` field | Emitted; `dry_run` only | `gitops_apply` live |
| gitops-controller sidecar | Stub (logs, no exec) | Real (calls ArgoCD API) |
| ArgoCD ApplicationSet | Not required | Required; documented install |
| Rollback automation | Field emitted, not executed | `argocd app rollback` wired |
| Prometheus counter | Emitted for `dry_run` | Emitted for all modes |

## References

- SPEC-S006-VS21: `docs/specs/SPEC-S006-VS21-closed-loop-gitops.md` (to be authored Sprint-4)
- ADR-004 Sprint-4 Extension: `RecommendedAction` schema additions
- ADR-005: Nephio stub-first approach (parent GitOps decision)
- Nephio R5 reference architecture: App of Apps + ArgoCD ApplicationSet
- ArgoCD ApplicationSet docs: https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/
- CLAUDE.md §9: P0 scope (copilot-api closed-loop listed as P1 boundary)
- CLAUDE.md §10: Forbidden scope (complete O2 IMS lifecycle remains P2/P3)
