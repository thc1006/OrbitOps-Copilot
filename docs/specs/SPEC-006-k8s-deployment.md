# SPEC-006 — k8s-deployment

| Field | Value |
|---|---|
| Status | Accepted — Sprint-1 shipped 2026-05-02 (Kustomize base + overlay/local + kubeadm live deploy + `make k8s-reload-observability`). **Sprint-2 VS-7 shipped 2026-05-02** (Helm chart 5 service templates + per-service `enabled` flag + env-var parity + Service names mirror Kustomize bare names per **ADR-009**). **Sprint-2 VS-11 shipped 2026-05-02** (ArgoCD `Application` reference at `deploy/argocd/orbitops-copilot.yaml` — Kustomize-driven sync, auto-prune + self-heal, finalizer for cascade-delete; opt-in usage in `deploy/argocd/README.md`; chart-driven sibling deferred Sprint-3+ pending ADR-009 adoption story). Sprint-3 Nephio kpt (VS-17) still pending. |
| Owner | k8s-platform-engineer |
| Sprint | 1 (VS-6 carry-over) + Sprint 2 (VS-7, VS-11) + Sprint 3 (VS-17) |
| Depends on | SPEC-002, SPEC-003, SPEC-004, SPEC-005 |
| Related ACs | AC-004 (k8s smoke part) |

## 1. User story

> 作為 NTN 整合測試工程師，我想要把整套 OrbitOps demo 在 **本機 kind 或 k3d** 上一鍵起來；同時 Helm chart 給「正式環境」一個發行管道——**這樣我** 才能驗證 K8s manifest 在 cluster 裡與在 docker-compose 裡行為一致。

## 2. Problem

docker-compose 是 dev 快路徑，K8s 才是「真實部署形貌」。沒有 K8s 部署路徑，pitch 中的「cloud-native」claim 立不住，且 Sprint 1 demo 與 Sprint 3 簡報之間就有縫隙。但同時，第一版**不**做完整 Nephio O2 IMS lifecycle（ADR-005），只做 stub package。

## 3. Scope

- **Sprint 1（VS-6）**：Kustomize base + overlay/local；kind cluster；首個 smoke test。
- **Sprint 2（VS-7）**：Helm chart skeleton 完整化；`helm template` + `helm lint` 通過 (verify.sh 5b/5 gate). **Shipped 2026-05-02** — chart has 5 service templates (emulator + copilot + ui + prometheus + grafana); each gated by its own `<svc>.enabled` flag; values.yaml has per-service section; **Service `metadata.name` mirrors the Kustomize bare names per ADR-009** so a stock `helm install` resolves DNS identically to compose / Kustomize (Prom scrapes work, copilot reaches emulator out of box). Deployment `metadata.name` keeps the `release-fullname-prefix` Helm idiom (DNS doesn't depend on Deployment name; selectors use `app.kubernetes.io/name` labels). External ConfigMaps (`orbitops-scenarios`, `orbitops-prometheus-config`, `orbitops-grafana-provisioning`) come from checked-in `deploy/k8s/base/*-configmap.yaml` (kustomize `resources:`, NOT `configMapGenerator`); only `orbitops-grafana-dashboards` is generator-backed. Helm-only deploys must apply those CMs first; Sprint-3 may vendor them into the chart if multi-release-per-namespace ever becomes a requirement (would need its own ADR superseding ADR-009).
- **Sprint 2（VS-11）**：ArgoCD App YAML reference（不需 mgmt cluster）— **Shipped 2026-05-02** at `deploy/argocd/orbitops-copilot.yaml`. Kustomize-driven sync; auto-prune + self-heal; `argocd.argoproj.io/sync-wave: "0"`; `resources-finalizer.argocd.argoproj.io` for cascade-delete; `CreateNamespace=true` so a fresh cluster install needs no namespace bootstrap; retry policy bounded (5 attempts, max 3min backoff) so genuine sync failures surface as Degraded. Pure reference — verify.sh's offline gate parses the YAML for structural sanity but does NOT kubeconform-strict validate (Argo CRD schema not in kubeconform's default set; opt-in command in `deploy/argocd/README.md`). Why Kustomize and not Helm: per ADR-009 the chart cannot adopt resources that already exist in the target namespace, so Kustomize-driven gives the cleanest first-install experience for the demo; sibling chart Application is Sprint-3+ once `--set adopt=true` lands.
- **Sprint 3（VS-17）**：Nephio kpt package stub（per ADR-005）。
- 4 個 service（emulator、copilot、ui、obs stack）皆有 Deployment + Service + ConfigMap。
- 每個 Deployment 帶 `resources.requests/limits` + `livenessProbe` + `readinessProbe`。

## 4. Non-scope

- 不做完整 OAI / srsRAN NTN full stack（ADR-001）。
- 不做完整 O-RAN O2 IMS lifecycle（ADR-005）。
- 不接真 cloud（AWS / GCP / Azure；MCP usage policy 已禁）。
- 不做 multi-cluster / 跨地域。
- 不做 mTLS / istio（demo 沙箱）。
- 不做 HPA / VPA（資源固定）。

## 5. Inputs

- 4 個 service 的 Docker image（pinned semver tag；current main: `:0.1.1-dev-g6g7g8` for emulator + copilot post-PR-#35; UI still `:0.1.0-dev`; never `:latest`）。Helm `values.yaml` + k8s `*-deployment.yaml` 必須同步。
- ConfigMap：scenario JSON（`packages/scenarios/*.json`）。
- Helm values（`deploy/helm/orbitops-copilot/values.yaml`）。

## 6. Outputs

- `deploy/k8s/base/`：5 個 YAML（namespace + 2 deployment + 2 service + kustomization）。
- `deploy/k8s/overlays/local/`：local-tuned overlay。
- `deploy/helm/orbitops-copilot/`：Chart.yaml + values + templates。
- `deploy/kind/cluster.yaml` / `deploy/k3d/cluster.yaml`：本機 cluster 設定。
- `deploy/argocd/orbitops-copilot.yaml`（Sprint 2 VS-11 — shipped 2026-05-02）：ArgoCD `Application` 範例（指向 `deploy/k8s/overlays/local`，opt-in usage 文件 `deploy/argocd/README.md`）. Lives in `deploy/argocd/` not `deploy/k8s/base/` — Application 是 ArgoCD CRD，住在 `argocd` namespace 由 ArgoCD 管，放進 base 會讓每次 kustomize render 都試圖 apply 一個 CR 到沒裝 ArgoCD 的 cluster。
- `packages/nephio-stubs/orbitops-groundstation-package/`（Sprint 3）：kpt package。
- `tests/k8s-smoke/`：smoke test bash + curl 腳本。

## 7. API or file contracts

**File contracts**：

| Path | 內容 |
|---|---|
| `deploy/k8s/base/kustomization.yaml` | 列 4 個 service + namespace |
| `deploy/k8s/overlays/local/kustomization.yaml` | local replicas / 資源 / image tag patch |
| `deploy/helm/orbitops-copilot/Chart.yaml` | name, version, appVersion, type |
| `deploy/helm/orbitops-copilot/values.yaml` | emulator + copilot + (P1) ui + (P1) obs 區塊 |
| `deploy/helm/orbitops-copilot/templates/_helpers.tpl` | label / fullname helpers |
| `deploy/helm/orbitops-copilot/templates/<svc>.yaml` | per-service Deployment + Service |
| `deploy/kind/cluster.yaml` | kind v0.31.0 cluster config |
| `tests/k8s-smoke/healthz.sh` | 啟動 cluster + apply + 等 ready + curl /healthz |

**Make targets**：`kind-up`、`kind-down`、`k8s-apply`、`k8s-smoke`、`k8s-reload-observability`（VS-7；防 obs ConfigMap 在 PR merge 後沒被 apply 而漂移；idempotent）。

## 8. Acceptance criteria

- AC-S006-1（**MET 2026-05-02**）：`kustomize build deploy/k8s/overlays/local | kubectl apply --dry-run=client -f -` exit 0（verify.sh gate 5 + CI `k8s-manifest` job 守住不退步）。
- AC-S006-2（Sprint 1 / VS-6 — kubeadm live deploy 已實機跑過 2026-05-02；`make kind-up` + smoke 自動化仍掛 I-8）：`make kind-up && make k8s-apply`（去 `--dry-run`）後，所有 pod 90 s 內 Ready。
- AC-S006-3（Sprint 1 / VS-6 — 同上，I-8 仍待）：`tests/k8s-smoke/healthz.sh` 從 cluster 內 `kubectl exec ... curl /healthz` 全 200。
- AC-S006-4（**MET 2026-05-02**）：`helm template` + `helm install --dry-run` exit 0（PR #47 + #48；CI `verify` job 5b/5 守住）。
- AC-S006-5（**MET**）：所有 image tag ≠ `:latest`；所有 Deployment 含 requests/limits + 2 個 probe。
- AC-S006-6（**partial / MET in base**）：`deploy/k8s/base/` Services 全 ClusterIP；`deploy/k8s/overlays/local/` 暫用 NodePort 為本機 demo 加速，已標記為 local-only（kubeadm InternalIP 31.41.34.19）；非 local 部署需走 port-forward 或 ingress。
- AC-S006-7（**MET 2026-05-05** — VS-17）：`packages/nephio-stubs/orbitops-groundstation-package` 通過 `kpt fn render` dry-run（不需真 Porch）。verify.sh §5d 守住此 gate（soft：kpt 在 PATH 才跑；CI image 加裝 kpt 後 flip blocking）。`.krmignore` 排除 `groundstation-profile.example.json`（非 KRM；schema 驗證走 verify.sh §4）。

## 9. Test strategy

- **Static**：`kustomize build` + `kubectl apply --dry-run=client` 進 verify.sh gate 5。
- **Helm**：`helm template` 進 CI（Sprint 2）。
- **Smoke**：`tests/k8s-smoke/healthz.sh` 起 kind + apply + 等 ready + curl；CI 用 kind-action。
- **Linting**：（P1）`kubeconform` 對所有 manifest schema 驗。
- **Anonymity**：`scripts/check-no-secrets.sh` 對 `deploy/**` 全掃。

## 10. Demo relevance

- **VS-6**：sprint review 必有 `make kind-up && make k8s-apply` 的 live demo（pod ready 倒數）。
- **VS-7**：簡報講「Helm chart 已可發行」一頁佐證；`helm template` 截圖。
- **VS-11**：ArgoCD App 截圖 + Nephio kpt package 對齊 narrative，是 RunSpace「Future Impact」分項加分點。
- **影片 0:20–0:30**：「Cloud-native sandbox + Kubernetes」字卡上配 kind cluster 截圖。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S006-1 | Kustomize / Helm 4 / kubectl 1.36 重大版本踩雷 | docs/09 已 pin；verify.sh gate 5 失敗即阻 |
| R-S006-2 | kind cluster 啟動慢（image pull） | 預先 `docker pull` cache；pod 90 s ready SLA |
| R-S006-3 | Probe 太敏感 / 太遲鈍 | livenessProbe `initialDelaySeconds: 5`；readiness 2 s |
| R-S006-4 | docker-compose 與 K8s 行為差異 → demo 從 compose 過 K8s 出問題 | VS-6 與 VS-1 共用同份契約 schema；smoke test 在兩處跑 |
| R-S006-5 | NodePort 誤開導致 RBAC 外洩 | 只用 ClusterIP；CI grep `NodePort` 失敗 |
| R-S006-6 | Helm chart 升級 hook 行為 v3→v4 變動 | `Chart.yaml` 已標 `# Verified for Helm v4.1.4`；升級走 ADR |
