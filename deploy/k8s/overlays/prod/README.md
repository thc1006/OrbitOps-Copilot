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

**Step 1 — operator creates the Secret out-of-band, BEFORE running
`kubectl apply -k`.** This overlay does NOT include the Secret in its
`resources:` list, by design (PR #63 review feedback, 2026-05-04):
including it would let `kubectl apply -k` overwrite the real Secret
with the placeholder template every time the overlay is applied.

```bash
kubectl create secret generic orbitops-grafana-admin \
  -n orbitops \
  --from-literal=password="$(openssl rand -base64 32)"
```

The reference file `grafana-admin-secret-template.yaml` is kept in-tree
as a copy-paste reminder of the schema; it is NOT applied.

**Step 2 — apply the overlay.** Two patches land:

1. Per-entry JSON6902 patches on the Grafana Deployment env array:
   - `env[1].value: "admin"` → `env[1].valueFrom.secretKeyRef` pointing
     at the `orbitops-grafana-admin` Secret created in Step 1.
   - `env[3].value: "true"` → `"false"` (disable anonymous auth).
   The patch is per-entry (not whole-array replace) so future base env
   additions aren't silently dropped, and `GF_AUTH_ANONYMOUS_ORG_ROLE`
   survives untouched.

2. (Future Sprint-3+) Drop the `nodeport-services.yaml` overlay —
   production goes through Ingress / LoadBalancer, not NodePort.

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
