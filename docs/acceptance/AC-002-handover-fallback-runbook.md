# AC-002 — Handover / Fallback Runbook

> 對應：UC2；SPEC-001/002/003/004。
>
> v2 contract notes (ADR-007 migration table):
> - request field: `anomaly_id` → `anomaly_type`（並要求 `metrics_snapshot`）
> - response field: `runbook` → `recommended_actions`（array of `{step, title, body}`）
> - metric names: `orbitops_handover_failures_total` / `orbitops_pod_health` → `orbitops_handover_state` / `orbitops_gateway_available` / `orbitops_anomaly_active{type=...}`

## Given

- emulator 載入 `handover-failure.json` 或 `gateway-fallback.json`
- 已有對應 anomaly 注入（e.g., `handover_failure`、`gateway_outage`）

## When

使用者按 UI 上 "Generate runbook" 或 `POST /runbook` with `{anomaly_type, metrics_snapshot, logs?}`。

## Then

1. `recommended_actions` 陣列含 ≥ 1 個 step，每 step 形如 `{step, title, body}`，題型涵蓋：
   1. What happened? (summary)
   2. Why it matters? (likely_cause)
   3. Recommended action.
   4. Risk if ignored. (risk_if_ignored)
   5. Next observation window or fallback profile.
   v2 schema 將 1+2+4 拉到 top-level（`summary`/`likely_cause`/`risk_if_ignored`），`recommended_actions[]` 只包含 3+5 類具體動作。FakeLLMProvider 對 `handover_failure` 預設出 ≥ 4 個 actions、對 `gateway_outage` 出 ≥ 3 個。
2. `evidence.metrics_used` 至少含一筆 v2 metric：`orbitops_handover_state{beam_id=...}` 或 `orbitops_gateway_available{gateway_id=...}` 或 `orbitops_anomaly_active{type="handover_failure"|"gateway_outage"}`。
3. `evidence.logs_used` 至少含一筆 mock log 行（Sprint 2 VS-10 接 Loki 後成立；Sprint 1 可空）。
4. `status == "ok"`。
5. `confidence` ∈ [0.5, 1.0]；`unknowns` 至少 1 條；`risk_if_ignored` 非空。
6. UI 將 `recommended_actions` 以可摺疊的 collapsible 顯示；`evidence` 以 JSON viewer 呈現。

## Failure modes

- 缺 `anomaly_type`：回 422（Pydantic 驗證；不是 400 — FastAPI 預設）。
- `metrics_snapshot` 為空 + `logs` 為空：回 `INSUFFICIENT_EVIDENCE`。
- `metrics_snapshot` 與 `anomaly_type` 不對齊（如 `anomaly_type=handover_failure` 但只給 `orbitops_beam_snr_db`）：回 `INSUFFICIENT_EVIDENCE`，`unknowns` 註明缺哪個 metric（PR-β 邏輯）。
