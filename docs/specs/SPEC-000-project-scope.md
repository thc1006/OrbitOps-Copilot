# SPEC-000 — Project Scope

| 項目 | 內容 |
|---|---|
| Status | Approved（Sprint 0） |
| Owner | architect |
| Last updated | 2026-04-30 |

## Goal

打造一個 **B5G/NTN 低軌地面站雲原生 operations digital twin + LLM Copilot** 沙箱，可在 7–14 天內交付 P0 demo，並可在 14–30 天延伸到 P1。所有元件容器化、Kubernetes 可部署、Prometheus/Grafana 可觀測，LLM 回答 evidence-grounded。

## Non-goals（第一版禁區）

1. 真 Ka-band beam steering / 真 SDR OTA / 真天線控制。
2. 完整 OAI 或 srsRAN NTN full stack 整合。
3. 完整 O-RAN O2 IMS lifecycle（只出 stub package）。
4. 完整 Nephio Porch 跑 sandbox。
5. 真 Sionna RT 跑 channel coefficients（P2）。
6. 真 AODT 整合（待 OSS 釋出後再評估）。
7. 多模態 agent swarm（先單模型 + structured prompt）。

## Stakeholders

- 假想使用者：NTN ground-station operator、教育訓練導師、整合測試工程師、pre-field validation 團隊。
- 評審：RunSpace Innovation Category 評審（公開資訊）。

## Constraints

- 7–14 天內必須有可 demo 的 MVP。
- 全部 OSS；不得綁單一商用 LLM API。
- 所有提交內容**匿名**（無 team / 學校 / 姓名 / Logo）。
- 每個 LLM 回答必附 evidence block；無證據必回 `INSUFFICIENT_EVIDENCE`。

## Inputs

- 公開的 3GPP Rel-19 NTN spec、TASA B5G LEO 計畫、CesiumAstro/YTTEK 合約、Nephio R5 文件、NVIDIA Aerial open-source 公告、AI-RAN Alliance MWC 2026 藍圖。
- 已查證的 OSS 版本表（`docs/09_installation_research.md`）。

## Outputs

- 7 個容器化 service（`scenario-generator`、`ntn-metrics-emulator`、`copilot-api`、`digital-twin-ui`、`voice-interface`、Prometheus、Grafana）。
- 3 個 golden scenario（beam-degradation、handover-failure、gateway-fallback）。
- 一份 RunSpace 簡報、90 秒 / 3 分鐘 demo 腳本。

## High-level interfaces

```
[scenario-generator] ─JSON─▶ [ntn-metrics-emulator] ─/metrics─▶ [Prometheus] ─query─▶ [Grafana]
                                                                                  │
                                                                                  ▼
                                                                        [digital-twin-ui]
                                                                                  ▲
                                                                                  │
                  user / voice ─────▶ [copilot-api] ◀────RAG────────────────┘
                                            │
                                            ▼
                                  [LLM provider adapter]
                                  (Ollama / vLLM / mock)
```

## P0 / P1 / P2 切分

| Tier | Scope |
|---|---|
| P0 | scenario-generator、ntn-metrics-emulator、copilot-api（mock provider）、ui shell、Prometheus、Grafana、kind/k3d、3 golden scenarios、CI |
| P1 | CesiumJS satellite pass 動畫、voice interface、Loki/Tempo、ArgoCD App-of-Apps、Helm values 完整化、真 Ollama+Qwen3.6 |
| P2 | Sionna RT integration、真 srsRAN/OAI、AODT、closed-loop GitOps reconcile |

## Open questions（needs verification before implement）

1. Vireo Ka 確切 beam 數（公開資料未揭露）。
2. AODT 開源 GitHub URL 與最低 GPU 等級（公告 2026-03 上線；驗證指令見 `verify.sh`）。
3. Rel-19 NTN regenerative 具體 TS 文號。

## Acceptance entry points

- `docs/acceptance/AC-001-beam-quality-copilot.md`
- `docs/acceptance/AC-002-handover-fallback-runbook.md`
- `docs/acceptance/AC-003-llm-grounding.md`
- `docs/acceptance/AC-004-demo-replay.md`
