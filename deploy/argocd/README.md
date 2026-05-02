# ArgoCD reference manifests

This directory holds reference ArgoCD `Application` definitions for OrbitOps
Copilot. Apply them to a cluster that **already has ArgoCD installed** in
the `argocd` namespace; OrbitOps does not bundle ArgoCD itself.

## Files

| File | Purpose |
|---|---|
| `orbitops-copilot.yaml` | ArgoCD `Application` syncing `deploy/k8s/overlays/local` into the `orbitops` namespace. Kustomize-driven; auto-prune + self-heal. |

## Usage

```bash
# 1. Bring up any K8s flavor with ArgoCD installed:
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.3.8/manifests/install.yaml
kubectl wait --for=condition=Available --timeout=180s -n argocd deployment/argocd-server

# 2. Apply the OrbitOps Application:
kubectl apply -f deploy/argocd/orbitops-copilot.yaml

# 3. ArgoCD reconciles `deploy/k8s/overlays/local` and creates the orbitops namespace.
kubectl get applications -n argocd orbitops-copilot
kubectl get pods -n orbitops

# 4. Forward the ArgoCD UI to confirm sync state:
kubectl port-forward -n argocd svc/argocd-server 8080:443
# Then open https://localhost:8080  (default admin password: see ArgoCD docs)
```

## Why Kustomize and not Helm?

Per **ADR-009**, the Helm chart cannot adopt resources that already exist in
the target namespace — `helm install` fails with `invalid ownership metadata`
when Kustomize-managed Services are present. For the GitOps reference
deployment, a Kustomize-driven Application gives the cleanest first-install
experience: ArgoCD creates everything from scratch, owns it via the
`Application` CR, and its `prune` + `selfHeal` semantics align cleanly with
single-source-of-truth GitOps.

A sibling `orbitops-copilot-helm.yaml` Application targeting the chart will
be added in Sprint-3+ once the chart's adoption story (`--set adopt=true`,
per ADR-009 §Consequences) is finalized.

## Why this file is NOT in `deploy/k8s/base/`

`deploy/k8s/base/kustomization.yaml` is rendered by every cluster install of
OrbitOps. The ArgoCD `Application` resource lives in the `argocd` namespace,
managed by ArgoCD itself — including it in the base kustomize render would
mean every kustomize install also tries to apply an Application CR to a
cluster that may not have ArgoCD installed. Keeping it under `deploy/argocd/`
is opt-in by intent.

## Validation

This manifest is parsed by `verify.sh`'s gate 5b but **not** validated by
`kubeconform` because the `argoproj.io/v1alpha1.Application` schema is not
built into kubeconform's default schema set. To strictly validate locally:

```bash
# Optional: pull ArgoCD CRD schemas
KUBECONFORM_SCHEMA="https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/argoproj.io/application_v1alpha1.json"
kubeconform -strict -summary \
  -schema-location "$KUBECONFORM_SCHEMA" \
  deploy/argocd/orbitops-copilot.yaml
```

The basic YAML parse + structural sanity (apiVersion/kind/metadata/spec/source/destination/syncPolicy)
is exercised in `verify.sh` via the path-existence + yaml-load gate.

## Pitch / RunSpace relevance

This Application demonstrates the "GitOps-first deploy" claim in
`docs/specs/SPEC-006-k8s-deployment.md` §10 Demo relevance and is the
foundation for the Sprint-3 Nephio kpt narrative (per ADR-005). It supports
`docs/03_breakthrough_directions.md` §"Cloud-native NTN sandbox" P1 path:
"P1 ArgoCD App YAML + Kustomize overlays → P2 真 Nephio mgmt cluster + Porch".
