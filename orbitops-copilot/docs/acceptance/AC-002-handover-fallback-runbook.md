# AC-002 — Handover / Fallback Runbook

> 對應：UC2；SPEC-001/002/003/004。

## Given

- emulator 載入 `handover-failure.json` 或 `gateway-fallback.json`
- 已有對應 anomaly 注入（e.g., `handover_failure_burst`、`gateway_pod_unhealthy`）

## When

使用者按 UI 上 "Generate runbook" 或 `POST /runbook` with `anomaly_id`。

## Then

1. `runbook` 陣列恰有 5 個 step，順序為：
   1. What happened?
   2. Why it matters?
   3. Recommended action.
   4. Risk if ignored.
   5. Next observation window or fallback profile.
2. `evidence.metrics_used` 包含 `orbitops_handover_failures_total` 或 `orbitops_pod_health` 至少一筆。
3. `evidence.logs_used` 至少含一筆 mock log 行。
4. `status == "ok"`。
5. UI 將 5 個 step 以可摺疊的 collapsible 顯示；evidence 以 JSON viewer 呈現。

## Failure modes

- 缺 anomaly_id：回 400 + `error`。
- 缺 metrics：回 `INSUFFICIENT_EVIDENCE`。
