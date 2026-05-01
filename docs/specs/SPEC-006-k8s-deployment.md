# SPEC-006 — k8s-deployment

| Field | Value |
|---|---|
| Status | Draft |
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
- **Sprint 2（VS-7）**：Helm chart skeleton 完整化；`helm template` 通過。
- **Sprint 2（VS-11）**：ArgoCD App YAML reference（不需 mgmt cluster）。
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

- 4 個 service 的 Docker image（CI build 後 tag `:0.0.1-dev` 或 commit SHA）。
- ConfigMap：scenario JSON（`packages/scenarios/*.json`）。
- Helm values（`deploy/helm/orbitops-copilot/values.yaml`）。

## 6. Outputs

- `deploy/k8s/base/`：5 個 YAML（namespace + 2 deployment + 2 service + kustomization）。
- `deploy/k8s/overlays/local/`：local-tuned overlay。
- `deploy/helm/orbitops-copilot/`：Chart.yaml + values + templates。
- `deploy/kind/cluster.yaml` / `deploy/k3d/cluster.yaml`：本機 cluster 設定。
- `deploy/k8s/base/argocd-app.yaml`（Sprint 2）：ArgoCD App 範例。
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

- AC-S006-1：`kustomize build deploy/k8s/overlays/local | kubectl apply --dry-run=client -f -` exit 0（已綠，本 SPEC 守住不退步）。
- AC-S006-2（Sprint 1 / VS-6）：`make kind-up && make k8s-apply`（去 `--dry-run`）後，所有 pod 90 s 內 Ready。
- AC-S006-3（Sprint 1 / VS-6）：`tests/k8s-smoke/healthz.sh` 從 cluster 內 `kubectl exec ... curl /healthz` 全 200。
- AC-S006-4（Sprint 2）：`helm template` + `helm install --dry-run` exit 0。
- AC-S006-5：所有 image tag ≠ `:latest`；所有 Deployment 含 requests/limits + 2 個 probe。
- AC-S006-6：無 NodePort 對外網；只 ClusterIP；外部走 port-forward。
- AC-S006-7（Sprint 3）：`packages/nephio-stubs/` 通過 `kpt fn render` dry-run（不需真 Porch）。

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
