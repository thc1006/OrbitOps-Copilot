# SPEC-002 — ntn-metrics-emulator

| Field | Value |
|---|---|
| Status | Draft (Sprint 1 contract amendment 2026-04-30) |
| Owner | ran-ntn-engineer + observability-engineer |
| Sprint | 1 (VS-1, VS-2, VS-3, VS-5) |
| Depends on | SPEC-001 (scenario v2) |
| Related ACs | AC-001, AC-002, AC-004 |
| Contract version | v2 (singular `/scenario/*` paths; new `/scenario/tick`; metric names prefixed `orbitops_beam_*` / `orbitops_link_*` per `docs/contracts/metrics.md`) |

## 1. User story

> 作為 ground-station operator，我想要看到一個**正在跑**的 NTN service：暴露 Prometheus metrics、可被注入 anomaly、同 scenario + 同時刻 → 同 metrics——**這樣我** 才能在沒有真 RAN stack 的情況下，端到端壓測 Copilot 與 dashboard。

## 2. Problem

第一版 7–14 天交付不可能接 OAI/srsRAN NTN full stack（ADR-001）。但 Copilot、Grafana、demo replay 都需要看「彷彿正在跑」的 metric stream。emulator 的工作就是用純函式 `(scenario, t) → metrics` 把這條 stream 變出來。

## 3. Scope

- FastAPI + prometheus-client：暴露 `/metrics`（Prometheus exposition）、`/healthz`、`/scenarios/load`、`/scenarios/current`、`/anomaly/inject`。
- Tick loop 每 `ORBITOPS_TICK_SECONDS`（預設 1）算一次 metrics。
- Anomaly injection：scenario 內預定義 + runtime POST 注入。
- 10 個 metric 名（見 §7），對應 `metrics.schema.json` enum。
- Deterministic：給同 scenario + 同 t + 同 seed → 同值。

## 4. Non-scope

- 不接真 RF / SDR / OAI / srsRAN（ADR-001）。
- 不寫盤（scenario 從 ConfigMap / volume 讀，狀態純記憶體）。
- 不接 LLM（屬 SPEC-003）。
- 不發 alerting（P1 由 Prometheus rules 接管）。
- 不做高保真軌跡（P2 Skyfield）。

## 5. Inputs

- Scenario JSON（從 `ORBITOPS_SCENARIO_PATH` 啟動載入；可被 `/scenarios/load` 替換）。
- Anomaly inject payload（runtime）：`{type, t_offset_s, duration_s, target, magnitude_db?}`。
- Tick interval（env `ORBITOPS_TICK_SECONDS`，預設 1）。
- Random seed（env `ORBITOPS_SEED`，預設 0）。

## 6. Outputs

- Prometheus exposition `/metrics`（HTTP 200, content-type `text/plain; version=0.0.4`）。
- `/healthz` → `{"status":"ok"}`。
- `/scenarios/load` → `{"loaded": "<scenario_id>", "n_beams": ...}`。
- `/anomaly/inject` → `{"injected": "<anomaly_id>", "active": true}`。

## 7. API or file contracts

**Metrics**（單一真相 = `tests/contracts/metrics.schema.json` v2 enum + `docs/contracts/metrics.md` 第 3 節）：

| Name | Type | Labels | Unit |
|---|---|---|---|
| `orbitops_beam_snr_db` | Gauge | `beam_id` | dB |
| `orbitops_beam_sinr_db` | Gauge | `beam_id` | dB |
| `orbitops_link_latency_ms` | Gauge | `beam_id` | ms |
| `orbitops_packet_loss_ratio` | Gauge | `beam_id` | ratio (0–1) |
| `orbitops_doppler_residual_hz` | Gauge | `beam_id` | Hz |
| `orbitops_handover_state` | Gauge | `beam_id` | enum (0/1/2) |
| `orbitops_gateway_available` | Gauge | `gateway_id` | 0/1 |
| `orbitops_anomaly_active` | Gauge | `type` | 0/1 |
| `orbitops_beam_elevation_deg` | Gauge | `beam_id` | deg (0..90) |

完整定義 / 範圍 / event→metric mapping 見 `docs/contracts/metrics.md`。

`orbitops_beam_elevation_deg` 由 G7（PR #34）加入：sinusoidal over `scenario.duration_seconds`，peak 由 optional `scenario.satellite.pass_peak_elevation_deg` 決定（預設 55°，schema-bounded ≤ 90°）。Producer 強制 clamp 到 `[0, 90]` 以滿足 metrics-contract 上界。完整 behavioral 定義（peak、shape、clamp 半開區間） + schema 欄位的權威來源見 `docs/contracts/metrics.md` §3 row 9 + `tests/contracts/scenario.schema.json`。

**HTTP API**（單數路徑，加 `/scenario/tick` 取代背景 tick loop 以利 deterministic 測試）：

| Method | Path | Body | 200 Response | Other |
|---|---|---|---|---|
| GET | `/healthz` | — | `{"status":"ok"}` | — |
| POST | `/scenario/load` | Scenario JSON v2 | `{"loaded","t","beams","gateways"}` | `400` if schema-invalid |
| POST | `/scenario/tick` | `{"seconds":<int>}` (預設 1) | `{"t","active_anomalies":[...]}` | `409` if no scenario loaded |
| GET | `/scenario/current` | — | `{"scenario_id","t","scenario"}` | `404` if no scenario loaded |
| GET | `/metrics` | — | Prometheus text exposition | — |

## 8. Acceptance criteria

- AC-S002-1：`/metrics` 含 ≥ 1 筆 `orbitops_snr_db{beam_id="beam-1"}`（VS-1 紅燈起點）。
- AC-S002-2：注入 `snr_drop` magnitude 6 dB → 對應 beam SNR 在 60 s 內下降 ≥ 5 dB（容忍 ±1 dB）。
- AC-S002-3：`/scenarios/load` 接受任何通過 `scenario.schema.json` 的 payload；錯誤 schema 回 400 含結構化錯誤。
- AC-S002-4：tick 延遲 < 50 ms（單機）；啟動 < 3 s。
- AC-S002-5：每個 metric 進 `metrics.schema.json` enum；新增 metric 必先 PR 改 schema。

## 9. Test strategy

- **Unit**：純函式 `compute_tick(scenario, t, seed)` 純測——與 HTTP 解耦。
- **Contract**：每個 metric output 過 `metrics.schema.json`；用 `jsonschema` 驗。
- **Golden**：scenario 重播 → 比對 `tests/golden/*.expected.json` 的 metric_assertions。
- **Integration**：FastAPI `TestClient` 跑 `/healthz`、`/metrics`、`/scenarios/load`、`/anomaly/inject`。
- **TDD red commit**：`services/ntn-metrics-emulator/tests/test_spec_002_red.py`（兩個 xfail）。
- **Determinism**：同 scenario + 同 t + 同 seed 跑兩次，diff < epsilon。

## 10. Demo relevance

- **VS-1**：emulator 是 Copilot evidence 的單一真值來源。Copilot 引用的 metrics 全部來自此 service 的 Prometheus scrape。
- **VS-2**：dashboard 30 s SLA 直接由 emulator 的 5 s tick × Prometheus 5 s scrape interval 決定。
- **VS-3**：UC2 runbook 的 evidence 同樣來自 `orbitops_handover_failures_total` 與 `orbitops_pod_health`。
- **VS-5**：tick seed 是 demo replay determinism 的關鍵。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S002-1 | metric 命名漂移 | 鎖在 `metrics.schema.json` enum；違反 → CI gate 4 fail |
| R-S002-2 | tick 不確定性（OS scheduling） | 邏輯上 tick = `t = (now - pass_start).total_seconds()`，不靠 monotonic 計數 |
| R-S002-3 | anomaly inject race condition（HTTP 並發） | 用 `asyncio.Lock` 或 single-event-loop 保護內部 state |
| R-S002-4 | 真 RAN stack 替換時契約破裂（P2） | metrics schema 為單一真相；wrapper 只需把 OAI 指標 map 過來 |
| R-S002-5 | Prom scrape 落後 → demo screenshot 取不到 anomaly | dashboard refresh = 5 s + Prom scrape = 5 s = SLA 30 s 內可達 |
