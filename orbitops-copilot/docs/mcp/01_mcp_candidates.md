# 01 — MCP Candidate Inventory

> 對每個 NEEDED / OPTIONAL 類別列出實際候選 server 與資料卡。
> 撰寫日期：2026-04-30。版本與發布日皆於該日經查證；標 **verify before install** 者請於安裝前再核。

---

## A. GitHub issue / PR（類別 #2）

### A.1 ★ `github/github-mcp-server`（推薦）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/github/github-mcp-server |
| Maintainer | **Vendor (GitHub Inc., 與 Anthropic 合作)** |
| Last updated | 活躍維護中；2026-01-28 GitHub Changelog 公告 scope filtering、新 projects 工具——**verify before install**：`gh release view --repo github/github-mcp-server --json tagName,publishedAt` |
| Install method | `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server` 或 Go binary `go build ./cmd/github-mcp-server` |
| Required permissions | classic PAT：`public_repo` 或 `repo` + `read:org` + `read:user`；fine-grained PAT：`Contents: read`、`Pull requests: read`、`Metadata: read` |
| Supported tools | toolsets `context, issues, pull_requests, repos, users, projects` 共 ~50+ 工具；`--read-only` 模式只保留讀取 |
| Risks | (1) PAT 洩漏 → 用 `${GITHUB_TOKEN}` env var 替換、`apiKeyHelper` 旋轉；(2) issue/PR body 為 prompt injection 載體（read-only 降低 blast radius） |
| 是否必要 | **是**（Sprint 1 起） |
| Phase | **P1** |

### A.2 `@modelcontextprotocol/server-github`（舊版，已 archive）

| 欄位 | 內容 |
|---|---|
| Status | 已遷移至 `modelcontextprotocol/servers-archived` |
| 結論 | **不裝**——被 A.1 取代 |

---

## B. Web / doc research（類別 #3）

### B.1 `@upstash/context7-mcp`（user-level 建議）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/upstash/context7 / https://www.npmjs.com/package/@upstash/context7-mcp |
| Maintainer | **Vendor (Upstash)** |
| Last updated | 2026 active（npm + 官方 remote 端點 `https://mcp.context7.com/mcp`） |
| Install method | `npx -y @upstash/context7-mcp --api-key ${CONTEXT7_API_KEY}` 或遠端 HTTP |
| Required permissions | API key（context7.com/dashboard 申請） |
| Supported tools | 2：`resolve-library-id`、`query-docs` |
| Risks | 查詢字串外送 Upstash；不含原始碼，但會送 lib 名稱 + 自訂查詢——**避免在查詢中描述本專案匿名性敏感資訊** |
| 是否必要 | optional |
| Phase | **user-level**（不入 project `.mcp.json`） |

### B.2 `mcp-server-fetch`（不推薦）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/modelcontextprotocol/servers/tree/main/src/fetch |
| 結論 | **不裝**——Claude Code 原生 WebFetch + WebSearch 已涵蓋；多裝徒增攻擊面 |

---

## C. Kubernetes inspection（類別 #4）

### C.1 ★ `containers/kubernetes-mcp-server`（推薦）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/containers/kubernetes-mcp-server （前身 `manusa/kubernetes-mcp-server`） |
| Maintainer | **Community（containers org，Marc Nuri 主導；Red Hat-aligned）** |
| Last updated | v0.0.61（2026-04-24）——**verify before install**：`gh release view --repo containers/kubernetes-mcp-server --json tagName` |
| Install method | `npx kubernetes-mcp-server@latest` / `helm install ... oci://ghcr.io/containers/charts/kubernetes-mcp-server` / Docker `mcp/kubernetes` |
| Required permissions | kubeconfig（推薦掛載 read-only，使用專屬 SA + view ClusterRole） |
| Supported tools | ~35（toolset：core 12、config 3、helm 3、tekton 4、kiali 8、kubevirt 3、kcp 2）；預設只啟 core + config |
| Risks | kubeconfig 過廣；用 `--read-only` + `--toolsets core,config,helm` 限縮 |
| 是否必要 | **是**（Sprint 1 起） |
| Phase | **P1** |

### C.2 `Flux159/mcp-server-kubernetes`（替代）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/Flux159/mcp-server-kubernetes |
| Maintainer | Community |
| 結論 | 替代方案；toolset gating 較粗、無顯式 `--read-only` flag——**不選**（C.1 安全旗標較完整） |

---

## D. Prometheus / Grafana metrics（類別 #5）

### D.1 ★ `grafana/mcp-grafana`（官方推薦）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/grafana/mcp-grafana |
| Maintainer | **Vendor (Grafana Labs)，Apache-2.0** |
| Last updated | 2026 active；Grafana ≥9.0 |
| Install method | Docker `mcp/grafana` 或 Go binary；支援 stdio + SSE + Streamable HTTP |
| Required permissions | Grafana service-account token（**強烈建議 viewer scope**） |
| Supported tools | ~30+：PromQL instant/range、label/metric discovery、dashboard CRUD、datasource list、alert rules、incident |
| Risks | SA token 寫權限若未限縮 → 可改 dashboard / datasource；用 viewer-scoped SA 限制 |
| 是否必要 | **是**（Sprint 1 obs 上線時） |
| Phase | **P1** |

### D.2 `pab1it0/prometheus-mcp-server`（補充）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/pab1it0/prometheus-mcp-server |
| Maintainer | Community（單一維護者——**監控 health**） |
| Last updated | active 2026；Helm chart `oci://ghcr.io/pab1it0/charts/prometheus-mcp-server` |
| Install method | Docker / Helm |
| Required permissions | `PROMETHEUS_URL` + `PROMETHEUS_TOKEN`（bearer 優先）；Prom 預設 admin API 關閉，攻擊面較小 |
| Supported tools | ~6：PromQL execute、metadata、targets、series |
| Risks | 直接 Prom URL 暴露；無內建 read-only enforcement |
| 是否必要 | optional |
| Phase | **P1（optional）** |

---

## E. Browser automation（類別 #6）

### E.1 ★ `@playwright/mcp`（推薦）

| 欄位 | 內容 |
|---|---|
| Source | https://github.com/microsoft/playwright-mcp |
| Maintainer | **Vendor (Microsoft)** |
| Last updated | 2026 active |
| Install method | `npx @playwright/mcp@latest` 或 Docker `mcr.microsoft.com/playwright/mcp` |
| Required permissions | 本機 browser 沙箱 |
| Supported tools | ~25：navigate、click、fill、snapshot（a11y tree）、screenshot、network capture |
| Risks | (1) persisted profile（`ms-playwright/mcp-{channel}-profile`）保留 cookie——CI 用 `--isolated`；(2) 任意 URL navigate → DOM 內容為 prompt injection 載體 |
| 是否必要 | **是**（UI 真實實作後） |
| Phase | **P2**（Sprint 2+） |

### E.2 `puppeteer-mcp`（不推薦）

| 欄位 | 內容 |
|---|---|
| 結論 | **不裝**——`modelcontextprotocol/servers#3662` 揭露 SSRF + sandbox 旁路 |

---

## F. 明令不裝清單（任何 sprint）

| 候選 | 為何不裝 |
|---|---|
| `@modelcontextprotocol/server-filesystem` | CVE-2025-53109 / 53110（EscapeRoute）；與 Claude Code 原生 Read/Write/Edit 重疊 |
| `mcp-server-fetch` | WebFetch / WebSearch 已涵蓋 |
| `mcp-server-git` | 2026-01-20 Cyata Security 揭露 3 漏洞；Bash 原生 git 已可 |
| Postgres / SQLite reference servers | 已 archived；Datadog 揭露 SQLi 案例；MVP 無 DB |
| AWS / Azure / GCP MCP | 無雲端使用；身分洩漏（cloud account/org 名稱進 transcripts） |
| Atlassian Rovo / Confluence / Jira | 匿名性違規（拉個人 workspace metadata） |
| Google Drive / Gmail / Calendar | 同上 |
| Linear / Asana 等工單 | 同上 + backlog 已在 markdown |
| Slack / Discord MCP | 訊息外送 = exfil 風險 |

---

## 引用來源

- [github/github-mcp-server](https://github.com/github/github-mcp-server)、[GitHub MCP Public Preview Changelog](https://github.blog/changelog/2025-04-04-github-mcp-server-public-preview/)、[2026-01-28 changelog](https://github.blog/changelog/2026-01-28-github-mcp-server-new-projects-tools-oauth-scope-filtering-and-new-features/)、[scope-filtering docs](https://github.com/github/github-mcp-server/blob/main/docs/scope-filtering.md)
- [@upstash/context7-mcp](https://www.npmjs.com/package/@upstash/context7-mcp)
- [containers/kubernetes-mcp-server](https://github.com/containers/kubernetes-mcp-server)、[Flux159/mcp-server-kubernetes](https://github.com/Flux159/mcp-server-kubernetes)
- [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)、[Grafana MCP docs](https://grafana.com/docs/grafana/latest/developer-resources/mcp/)、[pab1it0/prometheus-mcp-server](https://github.com/pab1it0/prometheus-mcp-server)
- [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)、[Playwright MCP docs](https://playwright.dev/docs/getting-started-mcp)
- [Cymulate — CVE-2025-53109/53110 EscapeRoute](https://cymulate.com/blog/cve-2025-53109-53110-escaperoute-anthropic/)
- [modelcontextprotocol/servers-archived](https://github.com/modelcontextprotocol/servers-archived)
- [Datadog Security Labs — Postgres MCP SQLi](https://securitylabs.datadoghq.com/articles/mcp-vulnerability-case-study-SQL-injection-in-the-postgresql-mcp-server/)
- [modelcontextprotocol/servers#3662 Puppeteer SSRF](https://github.com/modelcontextprotocol/servers/issues/3662)
