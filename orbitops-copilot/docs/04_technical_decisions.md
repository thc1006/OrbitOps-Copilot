# 04 — Technical Decisions（ADR 索引）

> 完整 ADR 內容請見 `docs/adr/ADR-NNN-*.md`。本檔僅索引與摘要。

| ID | Title | Status | 摘要 |
|---|---|---|---|
| ADR-001 | Metrics emulator first | Accepted | 第一版以純函式 emulator 取代真 RAN stack；契約化 metrics schema 以利 P2 替換。 |
| ADR-002 | CesiumJS（主）/ Three.js（備），不用 Isaac Sim 作 RAN ray-tracing | Accepted | web-based 視覺化用 CesiumJS 1.140；Isaac Sim 不適 RF；AODT/Sionna RT 留 P2。 |
| ADR-003 | Prometheus + Grafana 為 P0 唯一 obs 管道 | Accepted | Prometheus 3.11.3 + Grafana 13.0.1；Loki/Tempo/OTel/Alloy 列 P1。 |
| ADR-004 | LLM 必 RAG over metrics/logs；evidence 為強制契約 | Accepted | server-side RAG → JSON-mode → Pydantic 驗證 → 缺證據回 `INSUFFICIENT_EVIDENCE`。 |
| ADR-005 | Nephio：第一版只出 kpt package stub | Accepted | 不跑 Porch / 不跑完整 O2 IMS；kpt package 對齊 R5 慣例。 |

## 撰寫新 ADR 流程

1. 在 `docs/adr/` 建立 `ADR-NNN-<short-title>.md`（NNN 自動 +1，不可跳號）。
2. 從以下 template 複製：
   ```markdown
   # ADR-NNN — Title

   | 欄位 | 值 |
   |---|---|
   | Status | Proposed / Accepted / Superseded by ADR-MMM |
   | Date | YYYY-MM-DD |
   | Deciders | <roles> |

   ## Context
   ## Decision
   ## Consequences
   ## Alternatives considered
   ```
3. PR 與 SPEC 一同 review；Accepted 後同步更新本檔的索引表。
4. Superseded：在新 ADR 標 `Status: Supersedes ADR-NNN`，舊 ADR 改 `Status: Superseded by ADR-MMM`。
