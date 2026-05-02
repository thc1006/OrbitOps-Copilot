# SPEC-005 — observability

| Field | Value |
|---|---|
| Status | Accepted — Sprint-1 subset shipped 2026-05-02 (Prometheus 5 s scrape + Grafana 8-panel dashboard + provisioning + check-observability.sh contract gate). Sprint-2 Loki mock-logs (VS-10) + Tempo (optional) still pending. |
| Owner | observability-engineer |
| Sprint | 1 (VS-2) + Sprint 2 (VS-10) |
| Depends on | SPEC-002 |
| Related ACs | AC-001 (dashboard), AC-002 (logs in evidence) |

## 1. User story

> 作為 ground-station operator，我想要在 Grafana 看到 beam SNR / SINR / latency / packet loss / Doppler residual / beam elevation / handover state / gateway availability / active anomalies 一頁就懂；當 anomaly 注入後 30 秒內可見變化——**這樣我** 不必背 PromQL 就能知道 sandbox 正在發生什麼。

## 2. Problem

emulator 暴露 9 個 `orbitops_*` metric（`orbitops_beam_snr_db`、`orbitops_beam_sinr_db`、`orbitops_link_latency_ms`、`orbitops_packet_loss_ratio`、`orbitops_doppler_residual_hz`、`orbitops_handover_state`、`orbitops_gateway_available`、`orbitops_anomaly_active`、`orbitops_beam_elevation_deg`；完整契約見 `docs/contracts/metrics.md` §3）+ copilot-api 自身的 RED metrics（PR #34 G6），但沒人看就沒價值。一頁有意義的 dashboard 是 demo 與整合測試的視覺骨幹；同時 copilot-api 的 `evidence.metrics_used` / `logs_used` 都需要這條 obs pipeline 餵食。

## 3. Scope

- **Sprint 1（VS-2）**：Prometheus 3.11.3 scrape config + Grafana 13.0.1 dashboard JSON + provisioning。
- **Sprint 2（VS-10）**：Loki 3.7.1 mock-logs integration + Tempo（optional）。
- 30 秒 anomaly visibility SLA。
- Dashboard 一頁含：pass timeline、beam SNR/SINR、latency、packet loss、Doppler residual、handover state、active anomalies、gateway availability、beam elevation（`orbitops_beam_elevation_deg`，PR #34 G7 加入；panel id=8）。`scripts/check-observability.sh` REQUIRED list 是這份 dashboard 的 contract gate — 任何新 metric 必須同時加入該 list 才會 CI-pass。**註**：`pod_health` 在 ADR-007 v1→v2 migration 中已移除；gateway-fallback 路徑改由 `orbitops_gateway_available` 提供。

## 4. Non-scope

- 不啟 alertmanager（P1+；只在 dashboard 可見即可）。
- 不接真上游 Prometheus（local docker-compose only）。
- 不做 long-term storage（Sprint 3 評估 VictoriaMetrics）。
- 不接 Grafana Cloud（OSS-only）。

## 5. Inputs

- emulator `/metrics` HTTP scrape（5 s interval）。
- copilot-api `/metrics` HTTP scrape（15 s interval）。
- Sprint 2：service mock logs（stdout → Loki 推送）。

## 6. Outputs

- Grafana web UI（http://localhost:3000）顯示 dashboard。
- Prometheus TSDB 24 h retention。
- `copilot-api` 對 Prometheus 的 PromQL 查詢可拿到 evidence。
- Sprint 2：Loki 收到 mock logs，copilot 可拉。

## 7. API or file contracts

**Files**：

| File | 用途 |
|---|---|
| `observability/prometheus/prometheus.yml` | scrape config（5 s emulator, 15 s copilot） |
| `observability/grafana/provisioning/datasources/prometheus.yaml` | datasource auto-config |
| `observability/grafana/provisioning/dashboards/dashboards.yaml` | dashboard auto-load |
| `observability/grafana/dashboards/orbitops-overview.json` | 主 dashboard JSON |
| `observability/prometheus/rules/orbitops.rules.yml`（P1） | recording / alerting rules |
| `observability/loki/local-config.yaml`（Sprint 2） | Loki config |

**Dashboard panels（最少 7）**：beam SNR、Latency、Doppler residual、Active anomalies、Handover state（state machine view）、Pod health、Pass timeline。

## 8. Acceptance criteria

對應 AC-001（dashboard）、AC-002（logs in evidence）。額外：

- AC-S005-1：dashboard JSON 通過 `python3 -c "import json,sys; json.load(...)"` 解析。
- AC-S005-2：每個 panel 的 query metric 名都在 `metrics.schema.json` enum 內。
- AC-S005-3：注入 anomaly 後 30 秒內，dashboard auto-refresh 顯示變化（手動驗證 + screenshot）。
- AC-S005-4（Sprint 2）：`promtool check rules orbitops.rules.yml` exit 0。
- AC-S005-5（Sprint 2）：copilot 的 `evidence.logs_used` 含 ≥ 1 筆來自 Loki 的條目。

## 9. Test strategy

- **Static**：dashboard JSON parse；CI gate 4 含此檢查。
- **Schema cross-check**：Python 腳本（Sprint 2 加進 verify.sh gate 4）：解析 dashboard JSON 抽出 `targets[*].expr`，驗 metric 名稱皆在 schema enum。
- **Promtool**：`promtool check rules` 進 CI gate（Sprint 2 起）。
- **Visual**：sprint review 走過 dashboard、注入 anomaly、計時 30 秒。
- **Integration**：copilot-api 的 grounding test 對 Prometheus 跑 PromQL，回 evidence；CI 起 docker-compose 跑此整合測試（Sprint 2）。

## 10. Demo relevance

- **VS-2**：dashboard 是「30 秒 anomaly visibility」demo 主角；簡報必有 screenshot。
- **VS-3**：runbook evidence.logs_used 來自 Loki（Sprint 2 起）。
- **影片**：Grafana panel 在 90 秒影片 0:18–0:35 出現。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S005-1 | Dashboard 硬編 datasource 名 → 不同部署掛掉 | 用 datasource UID（`prometheus`）而非名稱 |
| R-S005-2 | Refresh 5 s + scrape 5 s → 偶爾跨 10 s 才看到變化 | dashboard `refresh: 5s`；30 s SLA 仍餘裕 |
| R-S005-3 | Loki / Tempo 在 docker-compose 起不來（image 大） | optional profile；P0 不依賴 |
| R-S005-4 | 引入未經授權的第三方 dashboard | 嚴禁；本 dashboard 全自製 |
| R-S005-5 | 監控 metric 名與 schema 漂移 | observability-dashboard skill 流程綁 metrics.schema.json 驗證 |
