# Demo — local Kubernetes deployment (kind, VS-6)

## Deploy

```bash
# 1. Build the three service images locally (kind reads them by name).
(cd services/ntn-metrics-emulator && docker build -t orbitops/ntn-metrics-emulator:0.1.0-dev .)
(cd services/copilot-api && docker build -t orbitops/copilot-api:0.1.0-dev .)
(cd services/digital-twin-ui && npm install && npm run build)
cat <<EOF > /tmp/orbitops-ui.Dockerfile
FROM nginx:alpine
COPY services/digital-twin-ui/dist /usr/share/nginx/html
EOF
docker build -t orbitops/digital-twin-ui:0.1.0-dev -f /tmp/orbitops-ui.Dockerfile .

# 2. Bring up the cluster and apply manifests.
./scripts/k8s-up.sh
```

After `k8s-up`, services are reachable from the host:

| Service | URL |
|---|---|
| ntn-metrics-emulator | http://localhost:30080/healthz |
| copilot-api          | http://localhost:30081/healthz |
| digital-twin-ui      | http://localhost:30073 |

## Live smoke test

```bash
./scripts/k8s-smoke-test.sh --live
```

Asserts: kubectl context exists → namespace `orbitops` exists → 3 services
exist → all pods Ready → in-cluster `/healthz` returns "ok".

## Static smoke test (no cluster needed; runs in CI)

```bash
./scripts/k8s-smoke-test.sh        # default = static
```

Validates:
- `kustomize build` renders cleanly
- `kubectl apply --dry-run=client` accepts every resource
- (optional) `kubeconform -strict` if installed
- every Deployment has resources.requests + resources.limits + livenessProbe + readinessProbe
- no image tagged `:latest`

This is hooked into `make verify` (gate 5).

## Cleanup

```bash
./scripts/k8s-down.sh
```

## Limitations (sprint 1)

- **NodePort exposure for kind only.** The `local` overlay adds NodePort
  Services explicitly. Base manifests use ClusterIP; **never apply the local
  overlay to a non-local cluster.**
- **No Prometheus/Grafana in K8s yet.** Use `docker compose` (VS-2) for the
  observability stack. K8s + Prom Operator integration is Sprint 2 backlog.
- **No GPU workloads.** Real-LLM provider (Sprint 2 VS-8) optionally adds
  Ollama; Sprint 1 stays mock-provider-only.
- **No cluster-admin needed.** All resources land in the `orbitops` namespace
  via standard Roles. No ClusterRoleBinding is created.
- **Nephio integration is stub-only.** `packages/nephio-stubs/` ships kpt
  package skeletons per ADR-005; no Porch / O2 IMS / FOCOM lifecycle is
  claimed. See `docs/future/nephio-o2ims-integration.md`.

## Future Nephio integration points

When real Nephio comes online (Sprint 3+ or post-RunSpace):

1. **Package**: convert `deploy/k8s/base/` into a kpt package under
   `packages/nephio-stubs/orbitops-groundstation-package/` with a Kptfile.
2. **Porch**: register the package in a Porch repository so workload-cluster
   deployments come from a versioned PackageRevision.
3. **O2 IMS ProvisioningRequest**: introduce a CR per ground-station whose
   spec references the kpt package + the kind cluster as the O-Cloud target.
4. **FOCOM inventory**: the ground-station profile (`station_id`, `location`,
   `supported_bands`) becomes a FOCOM resource so the SMO can discover it.

These are roadmap; **Sprint 1 ships intent only**.
