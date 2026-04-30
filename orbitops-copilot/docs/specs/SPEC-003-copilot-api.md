# SPEC-003 — copilot-api

| Field | Value |
|---|---|
| Status | Draft |
| Owner | llm-copilot-engineer |
| Sprint | 1 (VS-1, VS-3, VS-4) + Sprint 2 (VS-8, VS-10) |
| Depends on | SPEC-002 |
| Related ACs | AC-001, AC-002, AC-003 |

## 1. User story

> 作為 NTN ground-station operator，我想要用文字（P1 加語音）問 Copilot「Which beam is degrading and why?」、「Generate a runbook for handover failure」——**這樣我** 才能在 30 秒內拿到**有 metrics + logs 證據**的解釋與行動建議，**而不是憑空的幻想答案**。

## 2. Problem

通用 LLM 對 NTN 領域問題會自由幻想；不同 provider（Ollama / vLLM / OpenAI）回答品質差異大。本服務要在 **server side 強制 RAG over Prometheus + mock logs**，把 evidence 注入 prompt，並用 Pydantic 驗證模型輸出 schema。任何缺證據的回應一律 `INSUFFICIENT_EVIDENCE`，**不允許自由幻想**（ADR-004）。

## 3. Scope

- FastAPI 端點：`/healthz`、`/ask`、`/explain`、`/runbook`、`/providers`。
- Provider abstraction：`MockProvider`（Sprint 1）、`OpenAICompatibleProvider`（Sprint 2，相容 Ollama / vLLM / LM Studio / OpenAI）。
- Pydantic `CopilotResponse` 鎖 schema：`evidence` 區塊必填。
- Server-side RAG：從 Prometheus（PromQL）+ mock logs 拉 evidence。
- Sanitization：user input 透過 placeholder template，**不**直接 concat。
- JSON-mode（若 provider 支援），temperature ≤ 0.3。

## 4. Non-scope

- 不做 multi-turn long-running agent（每次請求 stateless）。
- 不做 function calling（Sprint 3+ 評估）。
- 不存 user 對話。
- 不接 web search（OOS）。
- 不做模型 fine-tune（用 prompt + evidence 即可）。

## 5. Inputs

- HTTP request body（見 §7）。
- 環境變數：`COPILOT_LLM_PROVIDER`（mock|openai-compatible）、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`OPENAI_API_KEY`、`COPILOT_TEMPERATURE`、`COPILOT_MAX_TOKENS`。
- Prometheus URL（`PROMETHEUS_URL`，預設 `http://prometheus:9090`）。
- Mock logs path / source（Sprint 1 為記憶體中 stub）。

## 6. Outputs

- HTTP response body：`CopilotResponse`（見 §7），通過 `tests/contracts/copilot-response.schema.json`。
- 自身 `/metrics`（Prometheus）：請求數、token usage、provider error 數、INSUFFICIENT_EVIDENCE 比率。

## 7. API or file contracts

**Endpoints**：

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/healthz` | — | `{"status":"ok"}` |
| POST | `/ask` | `{"question": str}` | `CopilotResponse` |
| POST | `/explain` | `{"anomaly_id": str}` | `CopilotResponse`（runbook 為 null） |
| POST | `/runbook` | `{"anomaly_id": str}` | `CopilotResponse`（answer + 5-step runbook） |
| GET | `/providers` | — | `[{"name":"mock","ready":true}, ...]` |

**`CopilotResponse` schema**（單一真相 = `tests/contracts/copilot-response.schema.json`）：

```json
{
  "answer": "string|null",
  "runbook": [{ "step":1, "title":"What happened?", "body":"..." }, ...] // 5 個或 null
  "evidence": {
    "metrics_used": [{ "name", "labels", "value", "timestamp" }],
    "logs_used":    [{ "source", "line", "timestamp" }],
    "scenario_id":  "string|null",
    "timestamp":    "ISO8601",
    "confidence":   0.0-1.0
  },
  "status": "ok | INSUFFICIENT_EVIDENCE | ERROR",
  "error":  "string|null"
}
```

**Prompt template invariant**：

```
system: "You are an evidence-grounded NTN ops assistant. Cite metrics by name."
user:   "{question}"                ← placeholder ONLY，禁止 f-string 拼接
context: "{evidence_json}"
output_schema: copilot-response.schema.json
```

## 8. Acceptance criteria

對應 `docs/acceptance/AC-001 / AC-002 / AC-003 .md`。額外：

- AC-S003-1：所有 4 endpoint 回應通過 `CopilotResponse` Pydantic 驗證。
- AC-S003-2：當 PromQL 結果為空 → 不呼叫 LLM，直接回 `INSUFFICIENT_EVIDENCE`。
- AC-S003-3：runbook 必為 5 step，順序固定（What/Why/Action/Risk/Next）。
- AC-S003-4：模型回應 JSON 解析失敗 → retry 1 次 → 仍失敗 → degrade 為 `INSUFFICIENT_EVIDENCE`，不向使用者顯示原始錯誤訊息。
- AC-S003-5：`temperature ≤ 0.3` 啟用；`/providers` 列出 ≥ 1 ready provider。

## 9. Test strategy

- **Unit**：
  - `test_ask_with_active_anomaly_cites_metrics`（紅燈，VS-1）
  - `test_runbook_returns_five_step_structure_with_evidence`（紅燈，VS-3）
  - `test_ask_rejects_prompt_injection_without_revealing_system_prompt`（紅燈，VS-4）
  - `test_empty_metrics_path_returns_insufficient_evidence`（紅燈，VS-4）
  - `test_pydantic_retry_then_degrade_on_invalid_json`（VS-4）
- **Contract**：每個 response Pydantic + jsonschema 雙驗。
- **Golden**：對 3 個 scenario 跑 `/ask` + `/runbook`，與 `tests/golden/*.expected.json` 的 copilot_assertions 比對。
- **Integration**：起 emulator + Prometheus + copilot，整條 RAG path 走通（Sprint 1 含 mock provider；Sprint 2 對 Ollama）。
- **Hallucination test**：給 random `anomaly_id` → 期望 `INSUFFICIENT_EVIDENCE`（AC-003.2）。
- **Injection test**：jailbreak prompt → answer 不含 `"You are an evidence-grounded"` 字串。

## 10. Demo relevance

- **VS-1**：UC1 demo 主角；mock provider 即可滿足 demo。
- **VS-3**：UC2 demo 主角；5-step runbook 是給評審看的「真的有 evidence」證據。
- **VS-4**：demo Q&A 環節評審可能故意送 jailbreak / 空 anomaly_id；本 SPEC 守住。
- **VS-8**：Sprint 2 切到 real LLM 後，同樣 demo 路徑用 Qwen3.6-27B 跑一次，證明 provider abstraction 正確。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S003-1 | LLM 幻想 | server-side RAG 強制注入 + Pydantic 驗證 + INSUFFICIENT_EVIDENCE 分支（AC-003.2） |
| R-S003-2 | Prompt injection 暴露 system prompt | placeholder template；AC-003.3 紅燈守 |
| R-S003-3 | Provider 斷線（Ollama down） | `/providers` 健檢；fallback 到 `MockProvider`（demo 不會掛） |
| R-S003-4 | JSON-mode 在不同 provider 行為差異 | Pydantic retry-then-degrade（AC-S003-4） |
| R-S003-5 | Temperature 漂移 → 同 query 答案不一致 | 固定 ≤ 0.3；測試斷言用「contains_any」而非完全相等 |
| R-S003-6 | Evidence 拉取慢於 30 s SLA | PromQL window 限 60 s；async；timeout 10 s |
| R-S003-7 | 真 LLM token cost 失控（Sprint 2+） | `/metrics` 上報 token usage；budget alert（P1） |
