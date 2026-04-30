# 00 — MCP Needs Analysis

> 把「MCP 該不該存在於本專案」這個問題拆成 10 類需求，逐一對照 repo 現況，得出 NEEDED / OPTIONAL / NOT NEEDED。
>
> 撰寫日期：2026-04-30；下一次評議：Sprint 1 結束時。

## 評估方法

對每一類需求問四題：

1. **repo 真的會用到嗎？** 列出對應的 SPEC / skill / command / sprint task。
2. **Claude Code 原生工具能否覆蓋？** Read/Write/Edit/Glob/Grep/Bash/WebFetch/WebSearch 已存在。
3. **加 MCP 會增加什麼？** 自動化、跨 session 狀態、外部系統存取。
4. **加 MCP 會帶來什麼風險？** 攻擊面、身分洩漏、版本維護、CVE。

只有「真會用 + 原生不夠 + 加值 > 風險」才標 NEEDED。

---

## 1. Repo file operations — **NOT NEEDED**

| 維度 | 結論 |
|---|---|
| 真會用？ | 是，幾乎所有 slash command 都讀寫檔案 |
| 原生覆蓋？ | ✅ Read / Write / Edit / Glob / Grep 完全覆蓋 |
| 加 MCP 加值？ | 0（Filesystem MCP 提供同樣的 11 個工具） |
| 風險？ | **CVE-2025-53109 / 53110**（symlink + 目錄逃逸，CVSS 8.4 / 7.3）；雙重攻擊面 |
| 結論 | 不裝 |

---

## 2. GitHub issue/PR — **NEEDED (P1)**

| 維度 | 結論 |
|---|---|
| 真會用？ | Sprint 1 起首 PR 開始；`/review`、`/implement`、`/release` 都會碰 |
| 原生覆蓋？ | 部分——`Bash(gh api:*)` 可讀 PR / issue / status，但無法在 LLM context 中結構化呈現 |
| 加 MCP 加值？ | PR diff、check status、review comments 結構化讀取；有 read-only 模式 |
| 風險？ | PAT 洩漏、issue/PR body 為 prompt injection 載體 |
| 結論 | Sprint 1 起裝 read-only；PAT 用 fine-grained scoped 到本 repo |

---

## 3. Web/doc research — **OPTIONAL (user-level)**

| 維度 | 結論 |
|---|---|
| 真會用？ | `orbitops-research` skill 經常需要查 lib docs |
| 原生覆蓋？ | ✅ WebFetch + WebSearch + `gh api repos/.../releases/latest` 已涵蓋 |
| 加 MCP 加值？ | context7 MCP 提供結構化 lib docs 查詢，較 WebFetch 精準 |
| 風險？ | context7 將查詢字串送 Upstash；查詢內容低敏（不含原始碼） |
| 結論 | **不入 project `.mcp.json`**；建議貢獻者於 user-level 自行裝 |

---

## 4. Kubernetes inspection — **NEEDED (P1)**

| 維度 | 結論 |
|---|---|
| 真會用？ | Sprint 1 task S1-09（kind smoke）；後續 `/demo` 反覆用 |
| 原生覆蓋？ | 部分——`Bash(kubectl get:*)` 已 allow，但結構化 pod/event 查詢需 MCP |
| 加 MCP 加值？ | 跨 namespace 列舉、events 結構化、Helm release 查詢 |
| 風險？ | kubeconfig 洩漏；個人 kubeconfig 帶 RBAC 過廣 |
| 結論 | Sprint 1 起裝 read-only + 專屬 ServiceAccount（view ClusterRole） |

---

## 5. Prometheus / Grafana metrics — **NEEDED (P1)**

| 維度 | 結論 |
|---|---|
| 真會用？ | `observability-dashboard` skill；`llm-grounding-review`（驗證 evidence 對應到真 metrics） |
| 原生覆蓋？ | 有限——PromQL 用 `Bash(curl)` 已 deny；要從 LLM context 查 series 必走 MCP |
| 加 MCP 加值？ | PromQL 查詢、dashboard JSON 操作、datasource 列舉 |
| 風險？ | Grafana SA token 寫權限 (mitigate: viewer scope)；Prom 直接暴露 |
| 結論 | Sprint 1 起裝 viewer-scoped Grafana MCP；Prom MCP 為 optional |

---

## 6. Browser automation — **NEEDED (P2)**

| 維度 | 結論 |
|---|---|
| 真會用？ | `demo-replay-hardening` skill 需截 Grafana / UI 圖；UI vitest 補 e2e |
| 原生覆蓋？ | 無——Bash 跑 Playwright 可，但 LLM 無法 inspect DOM 結構化 |
| 加 MCP 加值？ | `@playwright/mcp` 提供 a11y-tree snapshot、自動 click/fill |
| 風險？ | persisted profile 殘留 cookie；DOM 內容為 injection 載體 |
| 結論 | UI 真實實作後（Sprint 2+）裝；CI 用 `--isolated`；不 commit profile dir |

---

## 7. Database — **NOT NEEDED**

| 維度 | 結論 |
|---|---|
| 真會用？ | 否——MVP 無 DB；Prometheus TSDB 是時序庫，不是關聯庫 |
| 原生覆蓋？ | N/A |
| 風險？ | 官方 postgres / sqlite reference server **已 archive**；Datadog 揭露 SQLi 案例 |
| 結論 | 不裝 |

---

## 8. Cloud provider — **NOT NEEDED**

| 維度 | 結論 |
|---|---|
| 真會用？ | 否——MVP 鎖 local kind/k3d |
| 風險？ | (a) 需 cloud creds 進開發環境；(b) cloud account/org 名稱洩漏到 transcripts → 匿名性違規 |
| 結論 | **明令禁止**裝（CLAUDE.md 已禁），即使臨時不可 |

---

## 9. Design docs / Confluence / Drive — **NOT NEEDED + 禁止**

| 維度 | 結論 |
|---|---|
| 真會用？ | 否——簡報撰寫於 `docs/06_runspace_pitch_outline.md` 等本地 .md |
| 風險？ | **匿名性鐵律違規**：Atlassian / Drive / Gmail MCP 必拉個人帳號 metadata 進 transcripts |
| 結論 | **明令禁止** |

---

## 10. Ticketing — **NOT NEEDED**

| 維度 | 結論 |
|---|---|
| 真會用？ | 否——backlog 在 `docs/agile/backlog.md`；issue 走 GitHub（已由 #2 涵蓋） |
| 風險？ | 採新工單系統會綁工作區 ID（匿名性風險） |
| 結論 | 不裝 |

---

## 結論彙整

| 類別 | 狀態 | 行動 |
|---|---|---|
| 1. 檔案操作 | NOT NEEDED | 永不裝 |
| 2. GitHub | NEEDED | Sprint 1 P1 |
| 3. Web docs | OPTIONAL | user-level；不入 `.mcp.json` |
| 4. Kubernetes | NEEDED | Sprint 1 P1（read-only） |
| 5. Prom/Grafana | NEEDED | Sprint 1 P1（viewer） |
| 6. Browser | NEEDED | Sprint 2+ P2 |
| 7. Database | NOT NEEDED | 永不裝 |
| 8. Cloud | NOT NEEDED | 禁止 |
| 9. Design docs | NOT NEEDED | 禁止（匿名性） |
| 10. Ticketing | NOT NEEDED | 觀察期 |

**Sprint 0 「Must install now」清單：空。** 詳細候選與評分見 `01_mcp_candidates.md`。
