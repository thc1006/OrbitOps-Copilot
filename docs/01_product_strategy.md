# 01 — Product Strategy

## Problem statement

B5G/NTN 低軌地面站運維工具鏈在 2026/04 的公開資訊中存在**真實缺口**：衛星酬載與用戶終端的合約方已公布（CesiumAstro Vireo 1A、YTTEK SDR 1B、Skylark 用戶終端），但 Ka-band gateway 與運維工具鏈尚未有公開的雲原生、可觀測、AI-assisted 解法。傳統地面站工具多為廠商私有 GUI，不可雲部署、不能教學、無法整合測試。

## Target users

1. **NTN ground-station operators**：值班檢視 anomaly、生成 runbook。
2. **教育訓練團隊**（學校／法人）：以沙箱模擬 NTN 事件作教學。
3. **整合測試工程師**：pre-flight 驗證；scenario replay。
4. **pre-field validation**：硬體交付前的 dry-run。

## Jobs-to-be-done

- 「**為什麼這個 beam 在掉？**」——10 秒內取得有證據的解釋。
- 「**handover 失敗該怎麼辦？**」——5-step runbook。
- 「**fallback 到備援 gateway 安不安全？**」——含風險與下個觀察視窗的建議。
- 「**我可以在自己的筆電上跑整套 demo 嗎？**」——`make dev-up` 一鍵起。

## 兩個核心 Use Cases

### Use Case 1 — Beam Quality Copilot（UC1）

- 系統模擬 LEO satellite pass、ground station、3 個 candidate beams。
- 指標：SNR / SINR / latency / packet loss / Doppler residual / elevation / handover timer。
- 使用者用文字（P0）／語音（P1）詢問：`"Which beam is degrading and why?"`
- Copilot 以 metrics + logs 解釋並建議操作。
- AC：見 `docs/acceptance/AC-001-beam-quality-copilot.md`。

### Use Case 2 — Handover / Fallback Anomaly Explanation（UC2）

- 系統模擬 handover failure、gateway failover、Doppler compensation warning。
- K8s pod / service / config profile 狀態可被觀察。
- Copilot 產出 5-step runbook：
  1. What happened?
  2. Why it matters?
  3. Recommended action.
  4. Risk if ignored.
  5. Next observation window or fallback profile.
- AC：見 `docs/acceptance/AC-002-handover-fallback-runbook.md`。

## 不做的功能（reaffirm）

- 真 Ka-band beam steering、真 SDR OTA、真 RF。
- 完整 OAI / srsRAN NTN full stack。
- 完整 O2 IMS lifecycle。
- 多模態 agent swarm。

## MVP 定義（P0）

`scenario-generator + ntn-metrics-emulator + copilot-api(mock) + ui shell + Prometheus + Grafana + 3 sample scenarios + 4 AC 全綠 + docker-compose 與 kind 兩種部署`。7–14 天交付。

## Demo story（連貫敘事）

1. 開場：「2027 年某個冬夜，第一顆 B5G LEO 通訊衛星即將過境台灣上空。」
2. 切到 Grafana：3 個 beam 的 SNR / SINR 同步顯示。
3. t = 60s 注入 SNR drop on beam-1。
4. 操作員打開 Copilot 問：「Which beam is degrading and why?」
5. Copilot 回應含 evidence block，引用 `orbitops_snr_db{beam_id="beam-1"}`、`elevation` 等指標。
6. 切到 UC2：handover 失敗——Copilot 給 5-step runbook。
7. 收尾：強調 Sionna RT/AODT/真 RAN stack 為 P2 路線。

---

## 90 秒影片腳本（中英對照，提交時用全英文版）

| 秒數 | 中文旁白要點 | English narration |
|---|---|---|
| 0–10 | 開場：B5G LEO 計畫、地面站運維工具鏈缺口 | "Taiwan's B5G LEO program will fly its first Ka-band satellite in 2027. The payload partners are public — but the cloud-native operations toolchain for ground stations is not." |
| 10–25 | 介紹 OrbitOps Copilot：cloud-native operations twin + LLM | "OrbitOps Copilot is a cloud-native operations digital twin for B5G LEO ground stations: a Kubernetes sandbox with an evidence-grounded LLM copilot." |
| 25–55 | UC1 demo：beam degradation、Copilot 引用 metrics | "Watch beam-1's SNR drop. We ask: which beam is degrading? The copilot answers — citing the exact metrics that prove it." |
| 55–80 | UC2 demo：handover failure、5-step runbook | "Now a handover failure. The copilot generates a 5-step runbook: what, why, action, risk, next window." |
| 80–90 | 收尾、未來路線（AODT/Sionna RT/真 RAN） | "MVP today, AODT- and Sionna-RT-ready tomorrow. OrbitOps Copilot." |

## 3 分鐘影片腳本（英文字幕、時間軸）

> 提交時間：英文字幕、無旁白配音也可（screen capture + slide overlay）。

| 0:00–0:20 | Title + problem framing | TASA B5G LEO 1A (CesiumAstro Vireo Ka, ~2027) and 1B (YTTEK SDR baseband, ~2030) — payloads contracted, **ground-station operations toolchain is the public whitespace.** |
| 0:20–0:40 | What it is | Cloud-native operations digital twin + evidence-grounded LLM copilot. Built on Kubernetes (kind/k3d), Prometheus 3, Grafana 13, FastAPI, React 19, CesiumJS 1.140. |
| 0:40–1:10 | UC1 walkthrough | scenario-generator emits `beam-degradation.json`; emulator exposes `orbitops_snr_db` and friends; user asks "Which beam is degrading?"; copilot replies with `evidence.metrics_used`. |
| 1:10–1:40 | UC2 walkthrough | handover-failure scenario; pod_health drop; copilot generates 5-step runbook; UI shows collapsible runbook + JSON evidence viewer. |
| 1:40–2:10 | Architecture pan | Mermaid diagram from `docs/02_architecture.md`; emphasize boundaries: simulation vs real RF, P0 vs P2. |
| 2:10–2:30 | Standards anchoring | 3GPP Rel-19 NTN regenerative payload (frozen 2025-12), Nephio R5 ArgoCD GitOps, AI-RAN Alliance Reference Architecture (MWC 2026). |
| 2:30–2:50 | Future P2 | NVIDIA Aerial / AODT (Apache-2.0, AODT 2026-03), Sionna RT v2.0.1 channel realism, real OAI/srsRAN wrapper. |
| 2:50–3:00 | Close | "Operations twin for the ground segment that does not exist yet." |

## 10 頁 RunSpace 簡報大綱（英文）

詳見 `docs/06_runspace_pitch_outline.md`。
