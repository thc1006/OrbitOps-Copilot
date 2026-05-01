# 03 — Five Breakthrough Directions（分階段可落地）

> 每個方向皆「2026 前沿 + 可分階段落地」。MVP 鎖在方向 1+2 的 P0；方向 3-5 為 P1/P2/P3。

## D1 — NTN Operations Twin（P0 / 已立項）

- **背景**：地面段運維工具鏈在 B5G LEO 公開資訊中為缺口；3GPP Rel-19 NTN 已凍結（2025-12）。
- **2026 前沿**：regenerative payload + ISL handover + Store-and-Forward。
- **OSS**：Prometheus 3.11.3 + Grafana 13.0.1 + FastAPI 0.136.1 + CesiumJS 1.140。
- **路線**：P0 metrics emulator → P1 Loki/Tempo → P2 真 srsRAN/OAI wrapper。
- **MVP**：scenario-generator + emulator + Grafana dashboard。
- **風險**：與 3GPP 用詞漂移 → 由 ran-ntn-engineer 校對。
- **驗證**：AC-001 / AC-004。
- **簡報亮點**：與 Rel-19 凍結時序對齊；3GPP-aligned naming。

## D2 — AI-RAN Beam/Handover Copilot（P0 / 已立項）

- **背景**：AI-RAN Alliance MWC 2026 公布「Platform & Infrastructure Orchestration」藍圖（132 會員、33 個 demo）。
- **2026 前沿**：operations-side AI（不是 air-interface AI/ML）；evidence-grounded LLM。
- **OSS**：Ollama 0.22 / vLLM 0.20 / OpenAI-compatible adapter；Qwen3.6-27B（Apache-2.0）。
- **路線**：P0 mock provider + Pydantic schema → P1 Ollama+Qwen → P2 fine-tune small adapter on synthetic NTN runbooks。
- **MVP**：copilot-api `/ask`/`/explain`/`/runbook` + grounding test。
- **風險**：幻想／越獄 → strict evidence schema + temperature ≤ 0.3。
- **驗證**：AC-001 / AC-002 / AC-003。
- **簡報亮點**：與 AI-RAN Alliance 藍圖逐字對齊；不僭稱 air-interface AI。

## D3 — GitOps / Nephio Intent-to-Sandbox（P1 → P2）

- **背景**：Nephio R5（2025-07）支援 ArgoCD reconciliation；R6 將加 GenAI hydration。
- **2026 前沿**：把「想跑某個地面站場景」變成 Git commit。
- **OSS**：Nephio R5 + ArgoCD 3.3.8 + kpt + ConfigSync。
- **路線**：P1 ArgoCD App YAML + Kustomize overlays → P2 真 Nephio mgmt cluster + Porch → P3 GenAI hydration。
- **MVP**：`packages/nephio-stubs/orbitops-groundstation-package/` kpt skeleton。
- **風險**：完整 lifecycle 過重 → 第一版只 stub（ADR-005）。
- **驗證**：`kustomize build | kubectl apply --dry-run` 通過；Nephio kpt package lint。
- **簡報亮點**：「intent-to-sandbox」narrative。

## D4 — Closed-loop Anomaly Explanation + Rollback Recommendation（P2）

- **背景**：未來地面段運維會走向自動化反應；但**首先** AI 必須先能解釋＋建議。
- **2026 前沿**：closed-loop GitOps；human-in-the-loop confirmation。
- **OSS**：ArgoCD + Argo Rollouts + 自寫 reconciler。
- **路線**：P2 reconciler 從 copilot 取建議 → 寫 git commit → ArgoCD reconcile → 觀察 → 反饋 confidence。
- **MVP**：手動套用建議；自動化留 P3。
- **風險**：誤套錯誤建議 → 必須 human gate。
- **驗證**：模擬 rollback 場景；AC-002 升級版。
- **簡報亮點**：「先解釋，再建議，最後人類批准才執行」治理倫理。

## D5 — SDR-in-the-loop / AODT / Sionna RT 整合（P2 / P3）

- **背景**：NVIDIA 2025-10 開源 Aerial（Apache-2.0）；AODT 公告 2026-03 上 GitHub；Sionna RT v2.0.1（2026-04-01）。
- **2026 前沿**：把 sandbox 升級為「真 RF channel realism + 真 RAN stack」。
- **OSS**：Sionna RT、Aerial CUDA-Accelerated RAN、AODT、OAI/srsRAN NTN 分支。
- **路線**：
  - P2.a — Sionna RT 接 scenario.json → 產出 channel coefficients → 注回 emulator。
  - P2.b — emulator 替換為 OAI/srsRAN wrapper。
  - P3 — AODT 接 scenario.json → 整合 Omniverse 視覺化。
- **MVP**：先寫 adapter interface（不實作），讓 P2 易接。
- **風險**：GPU 等級需求高（GH200/H100）；與 Aerial 文檔需仔細對齊。
- **驗證**：`pip install sionna-rt` 通過；adapter contract test。
- **簡報亮點**：「Apache-2.0 開源紅利」narrative；differentiation vs AWS Ground Station。
