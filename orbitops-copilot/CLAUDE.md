# CLAUDE.md — OrbitOps Copilot

> 本檔為 Claude Code 的專案記憶，所有 agent 與貢獻者於每次工作前必讀。

---

## 1. Project mission

OrbitOps Copilot 是「**B5G/NTN 低軌地面站雲原生 operations digital twin + LLM Copilot**」沙箱。輸入是 satellite pass / beam / handover / Doppler / SNR / pod_health 等域內訊號；輸出是 anomaly explanation 與 runbook。每一個 LLM 回答必須附上 metrics / logs evidence block。

定位：**不是泛 AI chatbot，不是普通 Grafana dashboard**；是 NTN ground-station 運維訓練 / 整合測試 / pre-field validation 工具。

---

## 2. Non-negotiable constraints

1. **匿名性（範圍：投件交付物）**：RunSpace 投件 zip / pitch deck / 影片 / 簡報，以及 zip 內附帶的 `docs/`、UI 截圖、demo 錄製，禁止露出**真實姓名、學校、團隊名稱、Logo、學校 e-mail、私密 URL**。`scripts/check-no-secrets.sh` 與 CI 對 source 檔案掃描這些字串。Git workflow（commit author / committer / commit message / PR title）使用真實 GitHub 帳號（`thc1006` + GitHub noreply email），不在匿名範圍——RunSpace 規定限於提交檔內容，不要求 repo 隱藏 GitHub identity。
2. **不過度承諾**：禁止把 demo 說成「真 Ka-band beam steering」「真 SDR OTA」「真 OAI/srsRAN NTN full stack」「完整 O2 IMS lifecycle」。文件需明示「P0 為 metrics emulator」與「P2 才接 Sionna RT/AODT/真 RAN stack」。
3. **Evidence-first LLM**：copilot-api 任何 `/ask` `/explain` `/runbook` 回應必含 `evidence` 區塊（metrics_used / logs_used / scenario_id / timestamp / confidence）。無 evidence 時回 `INSUFFICIENT_EVIDENCE`，**不得自由幻想**。
4. **不硬綁單一 LLM 廠商**：以 OpenAI-compatible 介面為抽象，相容 Ollama / vLLM / LM Studio / 任何相容端點。
5. **MVP 7–14 天可交付**：P0 範圍嚴格限制（見第 9 節）。
6. **No secrets in repo**：`.env` 一律不上 git；`.env.example` 為模板；`pre-commit` hook 偵測。
7. **3GPP / NTN 正名**：場景與指標名稱對齊 Rel-19 用詞（regenerative / transparent payload、ISL、Store-and-Forward、Doppler residual）。

---

## 3. Architecture principles

- **Cloud-native first**：每個 service 皆為容器化、stateless、可水平擴充；以 Kubernetes manifest（Kustomize）為唯一部署來源；Helm chart 為發行管道；docker-compose 為 dev fast-path。
- **Domain types are first-class**：`SatellitePass`、`Beam`、`HandoverEvent`、`AnomalyInjection`、`PayloadMode` 為 Pydantic / TS interface 一等公民，不靠字串約定。
- **Evidence-grounded AI**：copilot 不直連模型；中介層強制注入 metrics / logs context window，並驗證輸出 schema（Pydantic）。
- **Boundaries are honest**：simulation vs real integration、P0 vs P2、metrics emulator vs full RAN stack——所有邊界寫在 `docs/02_architecture.md` 並於 README 簡述。
- **Observability is product, not infra**：Prometheus + Grafana + （optional）Loki/Tempo 為 demo 的一部分，不是事後加裝。
- **GitOps idiom**：以 ArgoCD（Nephio R5 風格）作為 reference；Flux 為替代；不必跑 Porch。

---

## 4. Coding rules

### Python（services/scenario-generator、ntn-metrics-emulator、copilot-api）

- Python 3.13（建議）；Python 3.11+ 為下限。
- 框架：FastAPI + Pydantic v2 + uvicorn；指標：prometheus-client；HTTP：httpx；測試：pytest；Lint/Format：ruff。
- 強制型別：`from __future__ import annotations`；公開函式必須有 type hints；mypy optional 但歡迎。
- 檔案結構：`src/<package>/{__init__.py, main.py, models.py, ...}` + `tests/`；packaging 用 `pyproject.toml`（PEP 621）。
- 不使用 print；用 `logging.getLogger(__name__)`。
- 不直接吞例外；至少 log + re-raise 或回 4xx/5xx with structured error。
- HTTP 路由命名 kebab-case；Python 變數 snake_case；類別 PascalCase。

### TypeScript / React（services/digital-twin-ui）

- React 19 + Vite 8 + TypeScript 6（嚴格模式）+ Tailwind 4。
- 視覺化：CesiumJS 1.140 為主、Three.js r184 為備案；圖表：Recharts。
- 元件 PascalCase、hook camelCase 以 `use` 開頭、CSS 類 kebab-case；資料夾 kebab-case。
- 不允許 `any`；錯誤回應透過 `ApiError` 型別處理。
- 所有 `console.error` 統一收斂到 `src/utils/logger.ts`。

### Shell

- `set -euo pipefail` 為強制標頭；用 long-form flag；輸出區分 `info` / `warn` / `error`。
- 任何破壞性指令需 `--confirm` 旗標；hook 中 **絕不** 自動 `rm`、`git push`、上傳。

---

## 5. Testing rules

- `make test` → 所有單元測試（Python: pytest；TS: vitest 或 build-only）。
- `make verify` → lint + typecheck + unit + secrets scan + k8s manifest validate。
- `./test.sh` 與 `./verify.sh` 為 thin wrapper。
- 每個 service 至少：1 個 health-endpoint test、1 個 contract test、1 個 golden scenario test。
- LLM 輸出測試：grounding test 驗證 evidence block 必填欄位；hallucination test 故意給空 metrics，期望 `INSUFFICIENT_EVIDENCE`。
- K8s smoke：`kind` 起 cluster、`kustomize build | kubectl apply --dry-run=client`。
- CI 跑全部上述 + docker build dry-run + 無 secrets 掃描。

---

## 6. Security and privacy rules

- `.env` 永不入 git；`.gitignore` 含 `.env*`、`.claude/settings.local.json`、`.claude/CLAUDE.local.md`、`secrets/`、`*.pem`、`*.key`。
- `scripts/check-no-secrets.sh` 在 pre-commit + CI 雙處執行；偵測 AKID / private key header / `.env` patterns / team-name 白名單。
- LLM prompt-injection note：copilot-api 對所有 user-supplied 字串套 sanitization；prompt 模板不直接拼接（用 placeholder + JSON schema）。
- MCP security note：本骨架預設**不啟用任何 MCP server**；如需啟用，先以 read-only stdio 模式檢視，禁止 long-lived token 直接寫入 `.mcp.json`。
- Hooks 僅做 lint / format / test / secrets-scan；**禁止** 自動刪檔、自動 push、自動上傳。
- 模型權重 / 大檔由 `.gitignore` 排除；以 HF Hub link + `pyproject.toml` 描述。

---

## 7. Submission anonymization rules

> 範圍：**RunSpace 投件交付物**——zip 包、pitch deck PDF、demo 影片、提交說明、zip 內 `docs/`、UI 截圖、影片旁白。**不**包含 git workflow（git author/committer/commit message/PR title 用真實 GitHub 帳號 `thc1006` + GitHub noreply email `84045975+thc1006@users.noreply.github.com`）。

1. 投件交付物中的文件、簡報、影片旁白皆不出現**真實姓名、學校全稱與縮寫、學校 e-mail、團隊名稱、Logo、內部 URL**。具體禁字模式由 `scripts/check-no-secrets.sh` 維護。
2. 截圖前把 OS 工具列、瀏覽器分頁、`whoami` 輸出、Slack/Linear UI 等可識別介面裁掉。
3. `scripts/check-no-secrets.sh` 在 pre-commit + CI 對 source 檔案內容掃描禁字（school、school e-mail、AKID、private key），**不**掃 git metadata。本機自填的禁字白名單放 `.secrets-baseline.txt`（不入 git）。
4. RunSpace 提交檔（zip / pdf / mp4）打包前跑 metadata 清洗：`exiftool -all= file.pdf`、`zip -X` 去 extra fields、影片用 `ffmpeg -map_metadata -1` 重編。
5. 真實姓名（即帳號擁有者中文本名）即使在 git author 為 `thc1006` 的情況下，**仍不得**寫進任何被打包進 zip 的 source / docs / UI string——因為 zip 是公開審查物。

---

## 8. Commands

```bash
# Bootstrap & tooling
make bootstrap            # install python/node tooling, create venv
make install-deps         # install per-service deps

# Dev loop
make dev-up               # docker compose up scenario+emulator+copilot+ui+prom+grafana
make dev-down             # tear down
make demo                 # run end-to-end golden scenario demo

# Quality gates
make lint                 # ruff (Python) + eslint (TS)
make typecheck            # mypy optional + tsc -b
make test                 # pytest + vitest (or skip)
make verify               # lint + typecheck + test + secrets + k8s validate
./verify.sh               # thin wrapper for CI

# K8s
make kind-up              # spin up local kind cluster
make kind-down            # destroy
make k8s-apply            # kustomize build | kubectl apply -f -
make k8s-smoke            # smoke tests against running cluster

# Packaging
make package-zip          # produce orbitops-copilot.zip (excluding venv/node_modules)
```

---

## 9. Current MVP scope（P0，7 天）

- `services/scenario-generator/`：3 個 sample scenarios（beam-degradation、handover-failure、gateway-fallback）。
- `services/ntn-metrics-emulator/`：FastAPI + `/metrics` Prometheus exporter；可注入 anomaly。
- `services/copilot-api/`：FastAPI；`/ask` `/explain` `/runbook` `/healthz`；OpenAI-compatible adapter（含 mock provider）；evidence-grounded。
- `services/digital-twin-ui/`：React + Vite skeleton（先有 UI shell + Copilot panel；CesiumJS pass viz 留 P1）。
- `observability/`：Prometheus scrape + Grafana dashboard。
- `deploy/`：docker-compose、kind、k3d、Kustomize base、Helm chart skeleton。
- `tests/`：unit + integration + golden + k8s smoke。
- CI：lint、typecheck、unit、secrets、manifest validate、docker build dry-run。

---

## 10. Forbidden scope（第一版禁止）

- 真 Ka-band beam steering、真 SDR OTA、真天線控制。
- 完整 OAI / srsRAN NTN full stack 整合。
- 完整 O-RAN O2 IMS lifecycle（只出 stub package）。
- 完整 Nephio Porch 跑 sandbox（只出 kpt package skeleton）。
- 真 Sionna RT 跑 channel coefficients（P2）。
- 真 AODT 整合（待 OSS 釋出後再評估，P2/P3）。
- 自由幻想的 LLM 回答。
- 商用閉源 LLM 強綁。
- 任何上傳資料到外部服務的 hook。

---

## 11. Definition of done（單一變更）

- `make verify` 全綠。
- 受影響 service 至少多一個測試（綠燈）。
- 文件：若 API/scenario schema 變動，同步更新 `docs/02_architecture.md` 或 `services/<svc>/README.md`。
- Commit message 不含真實姓名 / school / 團隊名（GitHub handle `thc1006` OK）。
- Pre-commit hook 通過（含 `scripts/check-no-secrets.sh`）。
- 若涉及版本號：先跑 `verify.sh`（會比對 GitHub Releases / PyPI）。

---

## 12. Engineering constitution（SDD / TDD / Agile）

> 本節為**不可妥協**的開發流程。所有 agent、貢獻者、Claude Code session 一律遵守。

### 12.1 SDD — Specification-Driven Development

- **每個功能先有 spec**：`docs/specs/SPEC-NNN-<short-name>.md`，含 Goal / Non-goals / Inputs / Outputs / Interfaces / Constraints / Open Questions。
- **每個 spec 對應 acceptance criteria**：`docs/acceptance/AC-NNN-<short-name>.md`，採 Given/When/Then；每條 AC 必須可被自動化測試驗證或人工 demo 驗收。
- **每個重大技術選型寫 ADR**：`docs/adr/ADR-NNN-<title>.md`（Status / Context / Decision / Consequences / Alternatives）。
- **沒有 spec 不寫 code**；沒有 AC 不算交付。
- **schema 是契約**：scenario / metrics / copilot response 三類 schema 統一放 `tests/contracts/*.schema.json`，所有測試以 schema 為真。

### 12.2 TDD — Test-Driven Development

- **Red → Green → Refactor**：先寫**失敗**的測試（commit 1：紅），再實作（commit 2：綠），再重構（commit 3：仍綠）。三步可合併但失敗測試必須先存在於 git history。
- **覆蓋層次**：每個 service 同時具備
  1. unit test（不開 socket、不打 LLM）
  2. contract test（驗 JSON schema）
  3. golden scenario test（replay `packages/scenarios/*.json` → 驗 expected metrics + copilot evidence）
- **未實作功能** 用 `pytest.mark.xfail(strict=True)` 或 `it.todo(...)` 標示；`test.sh` 須**清楚列出尚未存在的測試**，**不得偷偷 pass**。
- **LLM 測試**：grounding test（給 metrics → 必須引用）、hallucination test（不給 metrics → 必須回 `INSUFFICIENT_EVIDENCE`）、injection test（user prompt 含越獄字串 → 必須 sanitize）。

### 12.3 Agile — Vertical Slices

- **單位是 1–2 天可完成的 vertical slice**（含 spec、test、code、docs、demo screenshot）。
- 所有工作項目進入 `docs/agile/backlog.md`；每個 sprint 在 `docs/agile/sprint-NN-plan.md`；每 sprint 結束用 `docs/agile/sprint-review-template.md` 填一頁 review。
- Sprint 長度 1 週；Sprint 0 為 bootstrap（已完成本骨架）；Sprint 1 起進入 P0。
- **DoD（Definition of Done）** 見 `docs/agile/definition-of-done.md`，是合併與發行的硬性閘門。
- **Risk register**：`docs/agile/risk-register.md` 持續維護（Likelihood × Impact × Mitigation × Owner）。

### 12.4 Branching & PR

- `main` 永遠綠；功能在 `feat/<spec-id>-<slug>` 分支；fix 在 `fix/<issue>-<slug>`；docs 在 `docs/<slug>`。
- PR title：`[SPEC-NNN] <imperative summary>`；body 須引用對應 SPEC / AC / ADR。
- PR 須通過 `make verify` + CI；缺少 spec / AC 自動 reject。
- PR commit message 不得含**真實姓名** / school / 團隊名；GitHub handle `thc1006` 與 noreply email 視同 GitHub identity 可保留。

---

## 13. Agent OS — task → skill → subagent → command map

> CLAUDE.md 是憲法、`.claude/skills/` 是可重用操作流程、`.claude/agents/` 是角色、`.claude/commands/` 是入口。本節不重複各檔內容，只給對應表。

### 13.1 任務 → 工具映射（必讀）

| 任務情境 | 主要 skill | 主要 subagent | Slash command |
|---|---|---|---|
| 引入新外部事實／驗證版本 | `orbitops-research` | `researcher` | `/research <topic>` |
| 設計新 NTN scenario | `ntn-scenario-design` | `ran-ntn-engineer` | `/plan` → `/implement SPEC-001` |
| 實作 emulator metric/tick | `metrics-emulator-tdd` | `implementer`（+ `ran-ntn-engineer`） | `/implement SPEC-002` |
| 改 copilot prompt / provider | `llm-grounding-review` | `llm-copilot-engineer` | `/implement SPEC-003` → `/review` |
| 改 Kustomize / Helm / Nephio stub | `k8s-demo-deploy` | `k8s-platform-engineer` | `/implement SPEC-006` |
| 改 dashboard / scrape config | `observability-dashboard` | `observability-engineer` | `/implement SPEC-005` |
| 寫簡報 / demo 影片腳本 | `runspace-pitch` | `architect`（敘事）+ `researcher`（事實） | `/research` → 編輯 docs/06–08 |
| 加固 demo replay | `demo-replay-hardening` | `implementer` + `release-engineer` | `/demo` |
| Pitch 前事實審計 | `claims-audit` | `architect` + `security-reviewer` | `/review` |
| 任何 commit / PR / release | `no-secrets-anonymity-check` | `security-reviewer` | 自動 `/review` 與 `/release` 內建 |
| Sprint exit / 投件包裝 | （流程性，非單一 skill） | `release-engineer` | `/release <tag>` |

### 13.2 實作前必讀清單（Pre-implementation reading）

任何 `/implement SPEC-NNN` 之前必須讀：

1. `docs/specs/SPEC-NNN-*.md`（規格本身）
2. 對應 `docs/acceptance/AC-*.md`（在 SPEC 末段列出）
3. 相關 `docs/adr/ADR-*.md`（若 SPEC 引用）
4. 相關 `tests/contracts/*.schema.json`（契約）
5. 相關 skill SKILL.md（流程、verification、forbidden）

### 13.3 完成後必跑 verification commands（Post-implementation gates）

每次合併前依序執行（`make verify` 已封裝大部分）：

```bash
./verify.sh                                  # 6 gate（lint / test / secrets / schema / k8s manifest / anonymity）
pytest services/<svc>/tests -q -v             # 該 service 紅燈/綠燈狀態
python3 scripts/validate_schemas.py           # contracts + scenarios + golden
scripts/check-no-secrets.sh                   # 完整匿名性 + secrets
kustomize build deploy/k8s/overlays/local | kubectl apply --dry-run=client -f -
```

附加情境：

- copilot-api 變更 → 額外跑 `llm-grounding-review` skill checklist。
- 任何新 metric → 額外跑 `observability-dashboard` 的 30-second visibility check。
- pitch / docs/06–08 變更 → 額外跑 `claims-audit` skill。
- 包 zip / 投件 → 跑 `/release` 命令。

### 13.4 委派決策樹（給未來 session 參考）

```
是同一 PR 內的小調整？  → 自己做（`Read` / `Edit` / `Write`）
研究外部事實 ≥ 3 個來源？ → Agent(researcher)
設計新 SPEC / ADR？      → Agent(architect)
跨檔案大量重構？         → Agent(implementer) 一個 slice 一次
Code-review 一份 diff？  → Agent(security-reviewer) 含 claims-audit
RunSpace 提交準備？      → Agent(release-engineer)
特定領域 deep-dive？     → Agent(ran-ntn-engineer / observability-engineer / llm-copilot-engineer / k8s-platform-engineer / test-engineer)
```

---

## 14. MCP usage policy

> 完整推理見 `docs/mcp/00..04`；本節為日常規則摘要。

### 14.1 何時可用（Sprint 階段門檻）

| Server | 何時 OK | 何時禁止 | 必要設定 |
|---|---|---|---|
| **無**（Sprint 0 預設） | 永遠 OK | — | `.mcp.json` 不存在 |
| `github/github-mcp-server` | Sprint 1 首 PR 出現後 | Sprint 0；CI；Sprint 1 開 read-write | `--read-only` + fine-grained PAT 限本 repo |
| `containers/kubernetes-mcp-server` | Sprint 1 task S1-09 起 | Sprint 0；連線到正式 cluster | `--read-only --toolsets core,config,helm` + 專屬 SA + view ClusterRole |
| `grafana/mcp-grafana` | Sprint 1 obs 上線後 | Editor / Admin role token | viewer-scoped SA token |
| `pab1it0/prometheus-mcp-server` | Sprint 1 optional | Prom admin API 已啟用時 | bearer token；admin API 必 off |
| `@playwright/mcp` | Sprint 2+ UI 完成後 | profile 入 git；CI 不用 isolated | `--isolated --headless`；profile dir 進 .gitignore |
| `@upstash/context7-mcp` | 任何 sprint，**user-level** | 入 project `.mcp.json` | API key 走 user shell env |
| Filesystem / fetch / git / Postgres / SQLite MCP | **永遠禁止** | — | — |
| AWS / Azure / GCP / Atlassian / Drive / Gmail / Calendar / Slack / Linear MCP | **永遠禁止**（匿名性違規或不需要） | — | — |

### 14.2 安裝閘門

每個 MCP 安裝前必須：

1. 寫 ADR：`docs/adr/ADR-NNN-add-<server>-mcp.md`（Status / Context / Decision / Consequences / Alternatives）。
2. 跟 `docs/mcp/03_mcp_install_plan.md` 對應 §P1.x / P2 章節。
3. PR 兩人 review；含 `.mcp.json` diff、token scope 說明、rollback 指令。
4. token 走 `${VAR}` 注入；`.env.example` 加 commented slot；real token 由 contributor 走 OS keyring / 1Password / direnv，**永不** commit。
5. `scripts/check-no-secrets.sh` 必 pass。

### 14.3 使用守則（執行階段）

- 每次 prompt 模型欲使用 `mcp__<server>__<tool>` 工具時，必須是 `.claude/settings.json` `permissions.allow` 顯式列舉的工具名（**不可** 用 `mcp__server__*` wildcard）。
- 寫工具（`*__create_*`、`*__update_*`、`*__delete_*`、`*__post_*`）一律進 `permissions.deny`，除非有明確 ADR。
- LLM Copilot（copilot-api）的 evidence schema（ADR-004）對 MCP 結果同樣適用——MCP tool result 不能繞過 evidence 結構直接成為 user-facing answer。
- 任何升級 MCP server 版本 → 先 diff tool descriptions，避免 tool poisoning。

### 14.4 緊急下線

```bash
claude mcp list
claude mcp remove <name>
claude mcp reset-project-choices
# 或於 .claude/settings.json 加 "deny": ["mcp__<server>__*"]
export ENABLE_CLAUDEAI_MCP_SERVERS=false   # claude.ai-hosted MCPs 全 disable
```

---

## 15. References

- `docs/00_research_2026_04.md`：技術調研與來源。
- `docs/01_product_strategy.md`：產品策略與 use case。
- `docs/02_architecture.md`：架構圖、邊界、未來整合點。
- `docs/03_breakthrough_directions.md`：5 個分階段突破方向。
- `docs/04_technical_decisions.md`：ADR 索引。
- `docs/05_validation_plan.md`：測試與驗證。
- `docs/09_installation_research.md`：版本表 + 查證指令。
- `docs/specs/`：SPEC（SDD 入口）。
- `docs/acceptance/`：AC（驗收條件）。
- `docs/adr/`：ADR（技術決策）。
- `docs/agile/`：backlog / sprint / DoD / risk register。
- `tests/contracts/`：JSON schema 契約。
- `tests/golden/`：golden scenario expected output。
- `AGENTS.md`：subagent 角色定義。
