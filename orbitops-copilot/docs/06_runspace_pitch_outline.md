# 06 — RunSpace 10-page Pitch Outline (English)

> Anonymous — no team / school / personal identifiers.

| Page | Title | Content |
|---|---|---|
| 1 | **OrbitOps Copilot** | Tagline: "A cloud-native operations digital twin for B5G LEO ground stations." Visual: Mermaid simplified arch. |
| 2 | **The Gap** | TASA B5G LEO 1A (CesiumAstro Vireo Ka, ~2027) and 1B (YTTEK SDR, ~2030) — payloads contracted; **ground-station operations toolchain remains public whitespace**. Cite: TASA mission page; Via Satellite 2025-04-01; YTTEK 2026-01-16 announcement. |
| 3 | **What it is** | Cloud-native sandbox + evidence-grounded LLM copilot. Inputs: satellite pass / beam / handover / Doppler / SNR / pod_health. Outputs: anomaly explanation + 5-step runbook. |
| 4 | **Use Case 1 — Beam Quality Copilot** | screenshot of UI; user asks "which beam is degrading?"; copilot replies citing `orbitops_snr_db{beam_id="beam-1"}`. |
| 5 | **Use Case 2 — Handover / Fallback Runbook** | screenshot; 5-step runbook; mock pod health drop. |
| 6 | **Standards anchoring** | 3GPP Rel-19 frozen 2025-12 (regenerative payload, ISL, Store-and-Forward, IoT-NTN Phase 3, RedCap-NTN). Rel-20 freeze 2026-09 (Ku-band NR-NTN, GNSS-resilience). AI-RAN Alliance MWC 2026: "Platform & Infrastructure Orchestration" blueprint. |
| 7 | **Architecture** | full Mermaid; component boundaries; LLM evidence boundary; simulation vs real integration. |
| 8 | **Roadmap (P0/P1/P2)** | P0 (this MVP), P1 (CesiumJS pass + voice + Loki + ArgoCD), P2 (Sionna RT v2.0.1, Aerial OSS, AODT, real OAI/srsRAN). |
| 9 | **Differentiation** | vs AWS Ground Station / Azure Orbital / SatNOGS / NVIDIA AODT / generic Grafana — table from `docs/00_research_2026_04.md` §3. |
| 10 | **Closing** | Three deliverables: training sandbox + integration testbed + pre-field validator. Demo script: `make dev-up && scripts/run-demo.sh`. |

## 簡報設計守則

- 不使用團隊／學校／個人 Logo；所有 icon 用 OSS（Lucide / Heroicons）。
- 顏色避開校徽色；版式中性。
- 引用每個外部事實時加 footnote URL。
- 影片 / PDF 提交前 `exiftool -all=` 清空 metadata。
