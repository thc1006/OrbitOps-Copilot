# Sprint 2 — P0 完整 + P1 起步（vertical-slice）

| 欄位 | 值 |
|---|---|
| Duration | 1 週 |
| Sprint goal | Sprint 1 demo **「能在 K8s 上跑、能接真 LLM、能看時序圖、有語音輸入 stub」** |
| Demo | 實際 `make kind-up && make k8s-apply` + `Ollama` 跑 Qwen3.6-27B 的 real LLM 回答 + UI 時序圖 + GitOps reference YAML 展示 |

## Vertical slices

| ID | Slice | 切到的層 | Est | SPEC |
|---|---|---|---|---|
| VS-6 | K8s real-apply smoke（如 S1 未完成） | Kustomize + kind + smoke | 1d | 006 |
| VS-7 | Helm chart real install | values.yaml + chart-test pod + `helm install --dry-run` | 1d | 006 |
| VS-8 | Real LLM endpoint + Ollama Qwen3.6 | copilot-api OpenAICompatibleProvider + Ollama in compose + grounding test on real model | 2d | 003 |
| VS-9 | UI Recharts time-series + anomaly inject button | digital-twin-ui Recharts + UI 觸發 emulator inject | 2d | 004 |
| VS-10 | Loki mock-logs integration | Loki in compose + service log 寫入 + copilot 從 Loki 拉 evidence | 1d | 003/005 |
| VS-11 | ArgoCD App reference YAML | argocd-app.yaml + docs（不需 mgmt cluster） | 1d | 006 |
| VS-12 | Voice interface stub | faster-whisper 1.2.1 接口 + UI 語音按鈕（後端 stub） | 1d | 003 |

## Acceptance gates

- [ ] AC-001 / AC-002 / AC-003 / AC-004 仍綠（real LLM mode）
- [ ] `kustomize build deploy/k8s/overlays/local | kubectl apply` 真套用 kind
- [ ] `helm template` + `helm install --dry-run` 通過
- [ ] real LLM grounding test 對 Qwen3.6-27B 至少跑過一次（或文件記錄結果）
- [ ] Loki 收到 service mock logs，evidence.logs_used 非空
- [ ] `make verify` 6/6

## Risks

- VS-8 real LLM 可能在不同 GPU/CPU 上表現差異——以 mock 為 fallback
- VS-7 Helm 4 vs Helm 3 chart 行為差異——pin Helm 4.1.4 在 docs/09

## Demo

real LLM mode 錄一次 90 秒 demo 素材，與 Sprint 1 mock 版對照。
