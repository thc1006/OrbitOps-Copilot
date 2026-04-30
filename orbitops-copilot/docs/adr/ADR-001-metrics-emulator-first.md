# ADR-001 — Metrics emulator first；不接 OAI/srsRAN NTN full stack

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-04-30 |
| Deciders | architect, ran-ntn-engineer |

## Context

第一版 MVP 必須在 7–14 天內可 demo。OAI（v2.4.0、NTN 在分支）與 srsRAN（25.10、NTN 為實驗）即便能編可跑，整合一條完整 NTN stack（gNB + 5GC + UE + radio）的時間遠超預算，且需要特定 SDR 硬體，與雲原生沙箱本質衝突。

## Decision

第一版以 `ntn-metrics-emulator`（FastAPI + prometheus-client）取代真 RAN stack：純函式 `(scenario, t) -> metrics`，暴露 `/metrics`。場景命名沿用 3GPP Rel-19 用詞（`payload_mode`、`handover_state`、`doppler_residual`）以保留正名與未來替換性。

## Consequences

正面：
- 可在數天內交付完整 demo loop。
- 無 SDR / 無 RF 硬體依賴；CI、雲、教學環境皆可跑。
- 契約（scenario / metrics schema）穩定後，未來可把 emulator 替換成 OAI/srsRAN wrapper 而不動其他元件。

負面：
- 不能對 RF 物理層做任何精確聲明（需在文件中明示）。
- 評審若期待真 RAN stack，需以 P2 路線承接。

## Alternatives considered

1. **OAI 5G NTN 分支** — 整合時間 > 4 週、需 SDR、不雲原生。否決。
2. **srsRAN + ZeroMQ ZMQ-virtual radio** — 無 NTN feature、需自寫 NTN gateway shim、不開源資料偏少。否決。
3. **純 Grafana fake datasource** — 無 anomaly injection logic、無 LLM grounding 樣本。否決。

## Replacement plan（P2）

- 保持 `tests/contracts/metrics.schema.json` 為唯一真相。
- 把 emulator 替換成 OAI/srsRAN wrapper 時，所有下游（Prometheus、Grafana、copilot-api）零改動。
