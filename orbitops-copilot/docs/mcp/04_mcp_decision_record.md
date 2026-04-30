# 04 — MCP Decision Record

| 欄位 | 值 |
|---|---|
| Decision date | 2026-04-30 |
| Reviewer | MCP 安全架構師（本 session） |
| Status | Accepted（pending user instruction to install） |
| Supersedes | — |

## Context

OrbitOps Copilot 處於 Sprint 0 骨架階段。`.mcp.json` 不存在。Claude Code 原生工具（Read/Write/Edit/Glob/Grep/Bash/WebFetch/WebSearch）已涵蓋骨架建立、研究、測試 placeholder 等所有當前任務。

2025–2026 已揭露 ≥ 30 個 MCP 相關 CVE，含官方 Filesystem MCP 的 EscapeRoute（CVE-2025-53109/53110）、`mcp-server-git` 3 個 CVE、Puppeteer MCP SSRF，及 2026-04-16 OX Security 揭露的 stdio MCP 跨 SDK RCE。本決策必須對齊匿名性鐵律 + 最小授權原則。

## Decision

1. **Sprint 0 不安裝任何 MCP server。** Must install now 清單為空。
2. **Sprint 1 起按以下順序評估安裝**（每項先寫 ADR）：
   - `github/github-mcp-server`（read-only） — 第 1 個 PR 出現時
   - `containers/kubernetes-mcp-server`（read-only） — kind smoke 開始時
   - `grafana/mcp-grafana`（viewer） — obs stack 上線時
   - `pab1it0/prometheus-mcp-server`（optional） — 若 Grafana MCP 不夠
3. **Sprint 2+ 評估** `@playwright/mcp`（isolated）。
4. **永不安裝**：Filesystem MCP、`mcp-server-fetch`、`mcp-server-git`、Postgres/SQLite reference、AWS/Azure/GCP MCP、Atlassian/Drive/Gmail/Calendar/Slack/Linear MCP、Puppeteer MCP。
5. **context7 MCP** 留 user-level 由各 contributor 自行安裝；不入 project `.mcp.json`。

## Consequences

正面：

- 攻擊面最小；所有寫工具被 deny 規則 + read-only flag 雙重阻擋
- 匿名性風險（cloud account / Atlassian workspace / personal email）零；不會被 RunSpace 評審看見身分痕跡
- CI 不依賴 MCP，可在 GitHub Actions 中乾淨跑 `verify.sh` 與 `test.sh`
- 每個 sprint 引入新 MCP 前都有 ADR 留審計軌跡

負面：

- Sprint 1 開始時將遇到一波「需要更多自動化」的張力——必須以 ADR 而非權宜方案處理
- Contributor 各自於 user-level 裝 context7（`/research` 體驗有差異）
- 若上游 server 出新 CVE，本 repo 仍須監控（可訂 GitHub watch + 每 sprint review）

## Alternatives considered

1. **全裝 7 個 MCP（github + k8s + grafana + prom + playwright + context7 + filesystem）**：被否決——攻擊面過大、Sprint 0 不需。
2. **Sprint 0 裝 context7 一個於 project `.mcp.json`**：被否決——對個別 contributor 強加 Upstash 依賴；user-level 已可。
3. **裝 Filesystem MCP 求一致性**：被否決——CVE 風險 + 與原生工具重疊。
4. **Sprint 1 起裝 read-write GitHub MCP 直接讓 LLM 開 PR**：暫緩至 Sprint 2 評估；目前 read-only 即可滿足 `/review` 需求。

## Final summary table

| MCP | 用途 | 必要性 | 風險 | 階段 | 是否推薦 | 理由 |
|---|---|---|---|---|---|---|
| `github/github-mcp-server` | PR/issue/diff 結構化讀取 | High | PAT 洩漏、injection via PR body | **P1** | ✅ 推薦（read-only） | Sprint 1 起 first PR 時必要；fine-grained PAT + `--read-only` |
| `containers/kubernetes-mcp-server` | K8s 叢集檢視 | Medium | kubeconfig 過廣 | **P1** | ✅ 推薦（read-only + 專屬 SA） | Sprint 1 kind smoke S1-09；用 view ClusterRole |
| `grafana/mcp-grafana` | Grafana dashboard / datasource | Medium | SA token 寫權限 | **P1** | ✅ 推薦（viewer） | Sprint 1 obs 上線；viewer-scoped token |
| `pab1it0/prometheus-mcp-server` | PromQL 查詢 | Low | Prom URL 暴露 | **P1（optional）** | ⚠️ 視需要 | 補 Grafana MCP 路徑；Prom admin API 必 off |
| `@playwright/mcp` | UI 自動化 / 截圖 | Medium | profile 殘留、DOM injection | **P2** | ✅ 推薦（`--isolated`） | UI 真實實作後（Sprint 2+） |
| `@upstash/context7-mcp` | 函式庫文件查詢 | Low–Medium | 查詢字串外送（低敏） | **user-level** | ✅ 推薦於 user-level | 不入 project `.mcp.json`；各 contributor 自選 |
| `@modelcontextprotocol/server-filesystem` | 檔案操作 | None | **CVE-2025-53109/53110** | — | ❌ 不裝 | 與原生 Read/Write/Edit 重疊；EscapeRoute 漏洞 |
| `mcp-server-fetch` | URL 抓取 | None | SSRF（spec 已警示） | — | ❌ 不裝 | 原生 WebFetch 已涵蓋 |
| `mcp-server-git` | git 操作 | None | 2026-01-20 Cyata 揭 3 CVE | — | ❌ 不裝 | 原生 Bash git 已涵蓋；CVE 風險高 |
| `puppeteer-mcp` | Browser 自動化 | None | SSRF（issue #3662） | — | ❌ 不裝 | 用 Playwright MCP 取代 |
| Postgres / SQLite reference | 資料庫 | None | archived + Datadog SQLi 案例 | — | ❌ 不裝 | MVP 無 DB |
| AWS / Azure / GCP MCP | 雲端 | None | 身分洩漏（cloud account/org） | — | ❌ 禁止 | 無雲端使用；匿名衝突 |
| Atlassian Rovo / Confluence / Jira | 文件 / 工單 | None | 嚴重身分洩漏 | — | ❌ 禁止 | RunSpace 匿名鐵律 |
| Google Drive / Gmail / Calendar | 文件 / 通訊 | None | 嚴重身分洩漏 | — | ❌ 禁止 | 同上 |
| Linear MCP | 工單 | None | OAuth workspace 身分 | — | ❌ 不裝 | backlog 在 markdown |
| Slack / Discord MCP | 通訊 | None | 訊息外送 = exfil | — | ❌ 禁止 | 無使用情境 |

## Install events log

| Date | Sprint | Event | Result |
|---|---|---|---|
| 2026-04-30 | 0 | User invoked install: "只安裝被標記為 Must install now 的 MCP" | **0 installs** — Must install now set is empty per this ADR §Decision-1; preserved by skipping install, not by user negotiation. `.env.example` augmented with **commented** P1 token slots (no values). `.mcp.json` not created. |

To override this and install P1 candidates early, the user must:
1. Open an explicit override ADR `docs/adr/ADR-NNN-early-mcp-<server>.md`.
2. State which P1 candidate, why early, and the rollback plan.
3. Confirm the fine-grained token is provisioned with read-only scope.
4. Run the corresponding §P1.x procedure in `03_mcp_install_plan.md`.

## Re-evaluation triggers

下列任一發生即重啟本 ADR：

1. Sprint 結束 → 例行 review。
2. 任一已裝 MCP 出新 CVE。
3. RunSpace 評審期過後（2026 RunSpace 結果出爐後評估解 read-only / 解匿名性限制）。
4. AODT / Sionna RT / 真 RAN stack 整合需要 MCP（P2/P3）。

## Links

- `docs/mcp/00_mcp_needs_analysis.md` — 10 類需求 vs repo 現況
- `docs/mcp/01_mcp_candidates.md` — 候選 server 資料卡
- `docs/mcp/02_mcp_security_review.md` — 10 條安全最佳實踐審視
- `docs/mcp/03_mcp_install_plan.md` — 真要裝時的 step-by-step
