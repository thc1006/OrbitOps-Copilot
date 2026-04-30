# ADR-004 — LLM 必須 RAG over metrics/logs；evidence block 為強制契約

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-04-30 |
| Deciders | llm-copilot-engineer, security-reviewer, architect |

## Context

通用 LLM 可能對 NTN 領域問題自由幻想，且不同 LLM 表現差異大。本專案不接受幻想；必須有可被審計的證據鏈。

## Decision

1. copilot-api 在呼叫 LLM 前，由 server-side RAG 從 Prometheus / mock logs 抽出 `evidence`，作為 context 注入 prompt。
2. 模型輸出必須是 JSON，遵循 `tests/contracts/copilot-response.schema.json`；包含 `evidence` 區塊（metrics_used / logs_used / scenario_id / timestamp / confidence）。
3. 缺 evidence 時不得呼叫 LLM 或須回 `status == "INSUFFICIENT_EVIDENCE"`。
4. 不允許 user input 直接拼接系統 prompt；所有變數透過 placeholder。
5. temperature ≤ 0.3；JSON-mode 啟用（若 provider 支援）。

## Consequences

正面：
- 可被測試（grounding test、hallucination test、injection test）。
- 可被替換（mock provider 跑 CI；真 provider 跑 demo）。

負面：
- 開發複雜度高於直連模型 API。

## Alternatives

- 純 fine-tune：不可行（資料量、時間）。
- 純 prompt 約束：不夠強；歷次研究顯示模型仍會幻想。否決。
