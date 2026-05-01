# AGENTS.md — OrbitOps Copilot Subagent Roster

> **此檔為多代理工具的標準 project-memory 文件**：
> - **Claude Code**：透過 `.claude/agents/<name>.md` 與 `Agent` 工具讀取本檔的角色定義與共通規則。
> - **OpenAI Codex CLI**：把 `AGENTS.md` 視為預設專案說明文件（codex 啟動時自動納入 system context）。
> - **其他 SDD/agentic 工具（Cursor、Aider、Cline 等）**：許多現代代理工具皆採 `AGENTS.md` 慣例。
> 本檔的角色定義、規則與禁區對所有三類工具同等生效；若任一工具有特殊配置，列入 §共通規則 之後的對應子節，**禁止**在本檔之外重述同一條規則（單一真相）。

本檔以 Claude Code subagent frontmatter 規範定義七個專責角色。每個 agent 的完整 prompt 與 tools 清單放在 `.claude/agents/<name>.md`；本文件只交代**做什麼、不做什麼、輸入、輸出、交付標準**，避免重複。

---

## 1. researcher

- **角色**：技術調研、版本查證、來源蒐集、競品分析。
- **輸入**：題目（如「3GPP Rel-19 NTN regenerative」「Nephio R5 ArgoCD」）；既有 `docs/00_research_2026_04.md`；指令型問題。
- **輸出**：附 URL / 日期 / 信心度的 Markdown 條目；補進 `docs/00` 或 `docs/10_links.md`。
- **不可做**：寫程式碼；猜版本號；引用無連結之內部口耳資料。
- **交付標準**：每事實必附主要來源 URL 與日期；不確定者須註明「需安裝前再次確認」並附查證指令。

## 2. architect

- **角色**：系統架構、邊界界定、ADR 撰寫、Mermaid 圖維護。
- **輸入**：產品策略文件、研究結論、新需求。
- **輸出**：`docs/02_architecture.md`、`docs/04_technical_decisions.md`（ADR 編號連續）；component boundary、sequence diagram、data flow。
- **不可做**：實作 service；繞過已通過的 ADR；私下變更命名。
- **交付標準**：所有元件需標明「P0 / P1 / P2」；每個外部整合點需有「未來如何接」段落；每個 ADR 含 Status / Context / Decision / Consequences。

## 3. k8s-platform-engineer

- **角色**：Kubernetes manifests、Kustomize、Helm chart、kind/k3d cluster、ArgoCD App、Nephio kpt package stub。
- **輸入**：service 清單、port、env、資源需求、obs stack 整合需求。
- **輸出**：`deploy/k8s/`、`deploy/helm/`、`deploy/kind/`、`deploy/k3d/`、`packages/nephio-stubs/`。
- **不可做**：commit secrets；硬編 image tag 為 `:latest`；用 `nodePort` 隨機開放外網；忽略 resource requests/limits。
- **交付標準**：`kustomize build | kubectl apply --dry-run=client` 通過；`helm template` 通過；`make kind-up && make k8s-apply && make k8s-smoke` 全綠。

## 4. ran-ntn-engineer

- **角色**：NTN 場景建模、scenario JSON schema、emulator metrics 命名、handover/Doppler/SNR 物理合理性。
- **輸入**：3GPP Rel-19/Rel-20 文件；TASA B5G 公開資料；既有 scenario / metric。
- **輸出**：`services/scenario-generator/` scenario 檔；`services/ntn-metrics-emulator/` 指標名稱與 sane defaults；`packages/scenarios/*.json`。
- **不可做**：聲稱真 RF/SDR；引入未在 Rel-19/20 範圍的虛構欄位；改 LLM prompt（屬 llm-copilot-engineer）。
- **交付標準**：每個 scenario 含 `scenario_id`、`description`、`pass_window`、`beams[]`、`anomaly_injection`、`expected_runbook_keywords`；指標單位明確（dB、ms、Hz、ratio）。

## 5. observability-engineer

- **角色**：Prometheus scrape、recording rules、alerting rules、Grafana dashboard、Loki/Tempo 設定。
- **輸入**：emulator 暴露的指標清單；UC1/UC2 demo 需要看到的圖。
- **輸出**：`observability/prometheus/prometheus.yml`、`observability/grafana/dashboards/*.json`、`observability/grafana/provisioning/`。
- **不可做**：把警報門檻硬編到 dashboard；新增未經 architect 同意的指標。
- **交付標準**：dashboard 在 30 秒內呈現 anomaly；rules 通過 `promtool check rules`。

## 6. llm-copilot-engineer

- **角色**：copilot-api 的 prompt design、provider adapter、evidence schema、grounding test。
- **輸入**：UC1/UC2 規格、emulator metrics、可用 LLM endpoint（Ollama/vLLM/LM Studio）。
- **輸出**：`services/copilot-api/` `/ask` `/explain` `/runbook`；OpenAI-compatible adapter；mock provider；Pydantic evidence schema。
- **不可做**：硬綁單一商用 API；允許無 evidence 的回答；把 user input 直接 concat 進 system prompt（必須 placeholder）。
- **交付標準**：所有 response 通過 `EvidenceModel` 驗證；空 metrics 時回 `INSUFFICIENT_EVIDENCE`；單元測試覆蓋 grounding + hallucination + injection。

## 7. security-reviewer

- **角色**：secrets scan、依賴漏洞、prompt injection、MCP / hook 安全審查、匿名性檢查。
- **輸入**：每次 PR 的 diff；`scripts/check-no-secrets.sh` 規則；`.gitignore`、`.env.example`、`.claude/settings.json`。
- **輸出**：security review report；阻擋風險 commit；維護 `scripts/check-no-secrets.sh` 規則表。
- **不可做**：自行修改業務邏輯；放行任何含 token / e-mail / 真實姓名 / 學校的 commit。
- **交付標準**：CI security job 全綠；每個 release 前出一份 review checklist；hooks **不可** 含 `rm`、`curl`、`git push`、上傳到外部服務。

---

## 共通規則（所有 agent，與 `CLAUDE.md` 第 12 章鏡像）

> 本節為**雙寫條款**：與 `CLAUDE.md §12 Engineering constitution` 內容對齊；任一處更新時，另一處須同步。

### 開發流程鐵律（不可妥協）

1. **SDD（Specification-Driven Development）**：沒有 `docs/specs/SPEC-NNN-*.md` 與對應 `docs/acceptance/AC-NNN-*.md` 不寫 code；重大決策另立 `docs/adr/ADR-NNN-*.md`。三者缺一不予 merge。
2. **TDD（Test-Driven Development）**：紅 → 綠 → 重構。git history 必須先有一個失敗測試的 commit，後續 commit 才能讓它變綠。`pytest.mark.xfail(strict=True)` / `it.todo()` 用於尚未實作；`test.sh` 必須**清楚顯示 PENDING**，不得偷偷 pass。
3. **Agile vertical slices**：每個 backlog item 為 1–2 天可完成的縱切片（spec + test + code + docs + demo screenshot）；超過 2 天必須切片或先寫拆分 ADR。
4. **禁止第一版做真 SDR、真 Ka-band、真 OAI/srsRAN NTN full stack、真 O2 IMS 完整 lifecycle、真 Sionna RT/AODT 整合**。違反者 PR 一律拒絕。
5. **第一版範圍鎖死**：metrics emulator + copilot-api（含 evidence-grounded LLM）+ digital-twin-ui shell + Prometheus/Grafana + K8s deploy（kind/k3d + Kustomize + Helm skeleton + Nephio kpt stub）。其他項目進 `docs/agile/backlog.md` 後排。
6. **匿名性**：所有產出皆視為公開提交；commit author / 文件 / UI / 截圖 / 影片 metadata 皆禁露 team / 學校 / 個人姓名 / Logo / 內部 URL。`scripts/check-no-secrets.sh` 在 pre-commit 與 CI 雙處強制。

### 通用工作守則

7. **可閱讀檔案**：repo 內任何檔案；外網僅限 `docs/10_links.md` 列出之 allowlist。
8. **可執行工具**：Read / Write / Edit / Grep / Glob；Bash 僅限白名單命令（見 `.claude/settings.json`）。Hooks 禁止 `rm`、`curl`、`wget`、`git push`、上傳到外部服務。
9. **PR 規範**：title `[SPEC-NNN] <imperative summary>`；body 引用對應 SPEC / AC / ADR；不得使用 `--no-verify`；不得 force push 到 `main`。
10. **失敗回報**：若資訊不足，需明示 `INSUFFICIENT_INFORMATION` 並列出尚需查證的項目，不得腦補；版本號不確定者標 `需安裝前再次確認` + 查證指令。
11. **DoD 與 Sprint exit**：以 `docs/agile/definition-of-done.md` 為唯一閘門；每 PR / slice / sprint exit / 發行四級 checklist 全綠才算完成。

---

## Codex / 通用 agent 工具操作摘要（對齊 agents.md 規範）

> 本節 mirror `CLAUDE.md §13` 的 Agent-OS map，依 [agents.md](https://agents.md/)（Linux Foundation / Agentic AI Foundation 治理之 informal spec，2026-04 已 ≥ 60,000 OSS 專案採用）的慣例章節呈現。
>
> **多工具支援現況（2026-04）**：
> - **Codex CLI**：以 root-down 串接 `AGENTS.override.md` → `AGENTS.md`，預設總大小上限 32 KiB（`project_doc_max_bytes`）。本檔可被 `services/<svc>/AGENTS.md` 子檔疊加。
> - **Claude Code**：截至 2026-04 尚無原生 `AGENTS.md` 支援（[issue #6235](https://github.com/anthropics/claude-code/issues/6235)、[#34235](https://github.com/anthropics/claude-code/issues/34235) 仍 open）。本 repo 同時保留 `CLAUDE.md` 為 Claude Code 真值來源；社群 workaround 可 `ln -s AGENTS.md CLAUDE.md`，本 repo 不採用該 symlink，而採雙寫且互相 cross-reference。
> - **Cursor / Aider / Gemini CLI / Copilot 等**：原生讀取 `AGENTS.md`。

### Project overview

OrbitOps Copilot — cloud-native operations digital twin + evidence-grounded LLM copilot for B5G LEO ground stations. See `README.md` and `docs/01_product_strategy.md`.

### Setup commands

```bash
make bootstrap            # 建 .venv + 安裝 ruff / pytest / jsonschema / pyyaml / httpx
make install-deps         # Sprint 1+ 啟用：每 service 的 pip install -e + npm install
cp .env.example .env      # 填 OPENAI_BASE_URL / OPENAI_MODEL（mock 模式可空白）
```

### Test commands

```bash
make test                 # = ./test.sh，graceful PENDING-aware
make verify               # = ./verify.sh，6-gate 本地 CI
pytest services/<svc>/tests -q -v
python3 scripts/validate_schemas.py
```

`./test.sh` 顯示 PENDING **是 Sprint 0 的正常狀態**——表示功能尚未實作；不得偽裝成綠燈。當 `make bootstrap` 後 pytest 安裝，`@pytest.mark.xfail(strict=True)` 紅燈會自動轉為 XFAIL（pytest 仍 exit 0），實作完成後必須移除 xfail 才可合併。

### Code style

- **Python**：3.13+；`from __future__ import annotations`；公開函式必須有 type hints；ruff 為 lint+format；不使用 `print`，用 `logging.getLogger(__name__)`。
- **TypeScript**：strict mode；禁止 `any`；錯誤型別 `ApiError`；`console.error` 收斂於 `src/utils/logger.ts`。
- **Shell**：`set -euo pipefail`；長旗標；破壞性指令需 `--confirm`。
- **檔名**：Python snake_case；TS PascalCase（component）/ camelCase（hook/util）；CSS class kebab-case；資料夾 kebab-case。

### Domain constraints

- 所有 NTN 場景 wording 對齊 3GPP Rel-19：`payload_mode ∈ {transparent, regenerative}`、`handover_state`、`doppler_residual`、`elevation_deg`。
- Copilot response **必含** `evidence` 區塊；無 metrics → `status == "INSUFFICIENT_EVIDENCE"`；違反者以 `llm-grounding-review` skill 阻擋。
- Image tag 永不為 `:latest`；K8s 資源永遠帶 `requests/limits` + `liveness/readiness probe`。
- LLM provider 走 OpenAI-compatible 抽象，不硬綁單一商用 API。

### Security considerations

- `.env` 永不入 git；`scripts/check-no-secrets.sh` 在 pre-commit + CI 雙處強制（含 9 類 pattern：AKID、OpenAI/Anthropic key、GH token、private key header、學校名、學校 e-mail、個人 handle、gmail）。
- Hooks 禁止 `rm` / `curl` / `wget` / `git push` / 上傳外部服務（settings.json `deny` 規則覆蓋）。
- LLM prompt-injection：copilot-api 不直接 concat user input；用 placeholder template + JSON-mode + Pydantic 驗證。

### Boundaries — forbidden scope（第一版）

| 禁止項 | 為何 |
|---|---|
| 真 Ka-band beam steering / 真 SDR OTA / 真 RF | 7–14 天交付不可能 |
| 完整 OAI / srsRAN NTN full stack | ADR-001 |
| 完整 O-RAN O2 IMS lifecycle | ADR-005（只出 stub） |
| 真 Sionna RT / AODT 整合 | P2 |
| 任何上傳資料到外部服務的 hook | settings.json deny rules |
| Hooks 含 `rm` / `git push` / 自動刪檔 | settings.json |
| `--no-verify` commits | DoD §3.1 |
| 露出 team / 學校 / 姓名 / Logo | RunSpace 匿名規則 |

### PR / final response checklist（合併前必跑）

- [ ] 對應 SPEC-NNN + AC 已存在；PR title `[SPEC-NNN] <imperative>`。
- [ ] git history 有 `red` commit 在 `feat`/`tdd` commit 之前。
- [ ] `make verify` 6/6 綠。
- [ ] `pytest services/<svc>/tests -v` XFAIL 數量符合預期；無 XPASS-strict。
- [ ] 受影響 docs（SPEC Open Questions、PROJECT_STATUS、backlog）同步更新。
- [ ] 相關 skill SKILL.md verification checklist 全勾。
- [ ] commit author / metadata 不含 team / 學校 / 姓名。
- [ ] 若涉及 pitch 文件 → `claims-audit` 零 OVER-CLAIM。
- [ ] 若涉及 release → `/release` 走完並通過 DoD §3.4。

### MCP servers — 何時可用 / 何時禁止

> 詳見 `docs/mcp/00..04`；本節為快速查表。

| Server | 何時 OK | 何時禁止 |
|---|---|---|
| **無**（Sprint 0 預設） | 永遠 | — |
| `github/github-mcp-server` | Sprint 1 起，read-only + fine-grained PAT | Sprint 0；CI 自動環境；read-write 模式（除非有 ADR） |
| `containers/kubernetes-mcp-server` | Sprint 1 起，read-only + 專屬 view SA | Sprint 0；接正式 cluster |
| `grafana/mcp-grafana` | Sprint 1 obs 上線後，viewer SA token | Editor/Admin token |
| `pab1it0/prometheus-mcp-server` | Sprint 1 optional | Prom admin API 已啟用 |
| `@playwright/mcp` | Sprint 2+ UI 完成後，`--isolated` | profile 入 git；CI 不 isolated |
| `@upstash/context7-mcp` | 任何 sprint，**user-level** | 入 project `.mcp.json` |
| filesystem / fetch / git / postgres / sqlite | **永遠禁止** | — |
| AWS / Azure / GCP / Atlassian / Drive / Gmail / Calendar / Slack / Linear | **永遠禁止**（匿名性 + 範圍） | — |

任何安裝前須有 ADR 與 `docs/mcp/03_mcp_install_plan.md` §P1.x 對應步驟；token 走 `${VAR}` 注入，`.env.example` 留 commented slot，永不 commit real token。`.claude/settings.json` `permissions.allow` 顯式列舉 `mcp__<server>__<tool>`，禁止 wildcard。

緊急下線：`claude mcp remove <name>` + `claude mcp reset-project-choices` + `permissions.deny: ["mcp__<server>__*"]`。

### Final response 規範（agent 回覆使用者時）

回覆時必含：
1. **What changed**：具體 commit / 檔案 list（≤ 10 行）。
2. **Test status**：`make verify` 與 `make test` 結果。
3. **Open issues / next steps**：如有 PENDING / XFAIL / 未驗證版本，明列。
4. **不主動上傳任何資料**到外部服務。
