# ADR-003 — Prometheus + Grafana 為唯一可觀測管道（P0）

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-04-30 |
| Deciders | observability-engineer, architect |

## Context

OSS 雲原生 observability 候選：Prometheus / Grafana / Loki / Tempo / OTel / VictoriaMetrics / Alloy。MVP 需要快、簡、可在 docker-compose 起、可在 K8s 起。

## Decision

P0 採 Prometheus 3.11.3 + Grafana 13.0.1（已查證 2026-04 latest）。Loki / Tempo / OTel Collector 列為 P1。VictoriaMetrics 暫不採（適 long-retention，sandbox 不需）。Grafana **Alloy** v1.16.0 取代 EOL 的 Grafana Agent；P1 引入。

## Consequences

正面：
- 一條 scrape pipeline，labels 即查詢；學習曲線最低。
- dashboard JSON 為一等公民，可 versioning。

負面：
- mock logs 暫以檔案 / stub 提供，未集中化（P1 補 Loki）。

## Alternatives

- VictoriaMetrics（強，但對 sandbox 過量）。
- 純 Datadog/Dynatrace（商用、不雲原生 OSS）。
