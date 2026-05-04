# prod overlay — non-local hardening template (I-6)

Closes `docs/reviews/issues.md` I-6 partially: the local overlay
ships Grafana with `admin/admin` + `GF_AUTH_ANONYMOUS_ENABLED=true`
(safe for kubeadm-on-laptop demo, **not** safe for any non-local
deploy). This overlay shows the minimum patch set to harden Grafana
before exposing the cluster beyond `localhost`.

**Status: template / blueprint, not ready-to-apply.** OrbitOps does
not currently have a "production" deploy target (per SPEC-006 §4
non-scope: multi-cluster); this overlay exists so a future operator
or Sprint-3+ ingress work has a concrete starting point rather than
ad-hoc edits to `deploy/k8s/base/`.

## What this overlay would do (when used)

1. Replace `GF_SECURITY_ADMIN_PASSWORD` env literal with a
   `secretKeyRef` pointing at a Kubernetes Secret named
   `orbitops-grafana-admin`. Operator creates the secret manually:

   ```bash
   kubectl create secret generic orbitops-grafana-admin \
     -n orbitops \
     --from-literal=password="$(openssl rand -base64 32)"
   ```

2. Set `GF_AUTH_ANONYMOUS_ENABLED=false` so unauthenticated users
   see a login screen instead of the dashboard.

3. Drop the `nodeport-services.yaml` patch — production goes
   through Ingress / LoadBalancer, not NodePort.

## Why this isn't applied today

Local-laptop demo lives behind kubeadm + WireGuard; admin/admin is
fine when nothing reaches the API server externally. Promoting to
non-local requires:
- a real ingress controller decision (nginx-ingress vs ALB vs traefik)
- TLS cert provisioning (cert-manager + Let's Encrypt or in-house CA)
- network policy / pod security / RBAC review

Those are Sprint-3+ infra work, out of scope for the Sprint-2 demo.

## See also

- `docs/SECURITY.md` §S-3 (Grafana hardening checklist)
- `docs/reviews/security-review.md` (full security audit)
- `deploy/k8s/overlays/local/` (the demo overlay this contrasts with)
