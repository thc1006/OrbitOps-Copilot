# ADR-009 — Helm chart Service names mirror Kustomize bare names

- **Status**: Accepted (Sprint-2 entry, 2026-05-02).
- **Date**: 2026-05-02.
- **Supersedes**: none.
- **Superseded by**: none.
- **Drives implementation in**: PR `feat/sprint-2-helm-service-naming-adr-009`.

## Context

PR #47 (Phase H.2) shipped Helm templates for all 5 services. The bot review (`#47-3` / `#47-4` / `#47-5`) and the subsequent `/review` deep pass surfaced an architectural mismatch that left the chart **non-functional out of the box**:

| Surface | Service DNS in use | Source of truth |
|---|---|---|
| `deploy/docker-compose.yml` | `ntn-metrics-emulator`, `copilot-api`, `prometheus`, `grafana`, `digital-twin-ui` | Compose service keys |
| `deploy/k8s/base/*-service.yaml` | same as compose | bare Service `metadata.name` |
| `deploy/k8s/base/prometheus-configmap.yaml` | `ntn-metrics-emulator.orbitops.svc.cluster.local:8000`, `copilot-api.orbitops.svc.cluster.local:8001` | hard-coded scrape targets |
| `deploy/k8s/base/grafana-configmap.yaml` | `prometheus.orbitops.svc.cluster.local:9090` | hard-coded datasource URL |
| `deploy/helm/orbitops-copilot/templates/<svc>.yaml` (pre-ADR) | `<release>-orbitops-copilot-<svc>` | `{{ include "orbitops.fullname" . }}-<svc>` |

Both Kustomize and Compose agree on the bare Service names. The Helm chart's release-prefixed convention (a Helm idiom) **diverged** from that contract. The result: a stock `helm install` brought all 5 Pods Ready (probes are local), but Prometheus could not scrape (`ntn-metrics-emulator` did not resolve), Grafana had no datasource, and the Copilot's `_retrieval.py` fell back to `NullScraper` so every `/ask` returned `INSUFFICIENT_EVIDENCE`. Live demos worked only via the Kustomize path.

SPEC-006 §3 (post-PR-#47) marked VS-7 "Sprint-2 partial" pending an ADR — this is that ADR.

## Decision

**Chart Service `metadata.name` mirrors the Kustomize bare names**:

| Service kind | Helm template `metadata.name` |
|---|---|
| `templates/emulator.yaml` | `ntn-metrics-emulator` |
| `templates/copilot.yaml` | `copilot-api` |
| `templates/ui.yaml` | `digital-twin-ui` |
| `templates/prometheus.yaml` | `prometheus` |
| `templates/grafana.yaml` | `grafana` |

**Deployment `metadata.name` stays release-prefixed** (`{{ include "orbitops.fullname" . }}-<svc>`). Deployment names are internal bookkeeping — they do not participate in DNS or selector chains — so the Helm idiom of release-prefixed Deployments is preserved without compromising the DNS contract.

This is a deliberately asymmetric choice: **Services are the DNS contract; Deployments are namespace bookkeeping.**

## Alternatives considered

### Option B — chart vendors / Helm-templates the ConfigMaps

Move the Prometheus + Grafana ConfigMaps into `templates/` and parameterise their URLs via Helm template syntax. Service names stay release-prefixed.

**Rejected because:**
- **Two sources of truth**: `deploy/k8s/base/{prometheus,grafana}-configmap.yaml` (Kustomize) and `deploy/helm/orbitops-copilot/templates/{prometheus,grafana}-configmap.yaml` (Helm) would need to stay in sync. Drift is a question of when, not if.
- **Cross-tool sharing breaks**: a contributor running `helm install` on the chart could not reuse `kubectl apply -f deploy/k8s/base/prometheus-configmap.yaml` for the ConfigMap, and vice versa. The compose / Kustomize / Helm paths would diverge functionally even when they look identical.
- **Bigger blast radius**: every change to scrape config or Grafana datasources would need to land in two files. The PR #47 deep-review caught one comment-claim mismatch repeated across 5 places (commit `2cca316`); duplicating templates invites the same class of bug.

### Option C — keep release-prefixed Service names; require values overrides

Document `--set copilot.emulatorMetricsUrl=http://<release>-orbitops-copilot-emulator:8000/metrics` (and equivalent for Prometheus/Grafana) on every chart install.

**Rejected because:**
- The default `helm install` produces a broken demo. SPEC-007 acceptance gate AC-S007-6 requires the chart's archive to `make verify` cleanly; a chart that is "use-with-mandatory-flags-or-it's-broken" violates that.
- Off-loads correctness to documentation, where it rots fastest.

### Option D — drop release prefix from Deployments too

Make Deployment `metadata.name` also bare (`ntn-metrics-emulator`, etc.).

**Rejected because:**
- No functional gain (Deployment name is not DNS-resolvable; selectors use `app.kubernetes.io/name` labels).
- Loses the Helm convention of release-tagged Deployments, which makes `helm uninstall` trace-back slightly less obvious in `kubectl get deploy` output.
- Not symmetric with the actual contract — only Service name participates in DNS, so only Service name needs to match.

## Consequences

### Accepted

- A single-namespace deploy of two chart releases will fail at the second `helm install` with a Service-name conflict. **OrbitOps does not support multi-release-per-namespace** — the demo is single-environment by design (SPEC-006 §4 "non-scope: multi-cluster / 跨地域"). If that requirement ever changes, this ADR is superseded.
- Sprint-2 multi-tenant demo (if anyone proposes one) is blocked at the Service-name layer; that's a feature, because that proposal would need its own ADR.
- The `app.kubernetes.io/instance: <release>` label still differentiates which Helm release owns each resource — `kubectl get all -l app.kubernetes.io/instance=foo` still works as Helm intends.

### Eliminated

- The "stock helm install creates a green-but-broken demo" footgun documented in PR #47 review #47-3/4/5.
- The `copilot.emulatorMetricsUrl` values.yaml override warning (now correct out of box).
- The SPEC-006 §3 "Sprint-2 VS-7 partial" caveat.

### Test impact

- `helm template` output for Service `metadata.name` shifts from `<release>-orbitops-copilot-<svc>` to bare `<svc>`. No test currently asserts against the old form, so no test churn.
- `helm lint` continues to pass (bare names are valid DNS-1035 labels).
- `verify.sh` 5b/5 helm gate already exercises both `helm lint` + `helm template` (post-PR-#47); this ADR's implementation lands clean against those gates.

## Implementation hooks

- 5 template files: change Service `metadata.name` line only. `selector` blocks (which use `app.kubernetes.io/name` labels) and `port` blocks remain untouched.
- `values.yaml`: remove the `copilot.emulatorMetricsUrl` "override required" warning; the default is now correct.
- `SPEC-006` Status: flip "Sprint-2 VS-7 partial" → "Sprint-2 VS-7 shipped".
- All 4 stale comment blocks corrected by commit `2cca316` (PR #47 Tier A) remain accurate.

## References

- PR #47 deep `/review` → flagged as Tier B "Helm release-fullname-prefix vs Kustomize fixed-name conflict".
- `docs/specs/SPEC-006-k8s-deployment.md` §3, §7.
- `docs/agile/backlog.md` Sprint-2 VS-7.
- `deploy/k8s/base/kustomization.yaml` (canonical Service-name set).
