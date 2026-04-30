# Sprint 1 — Vertical-slice P0 critical path

| 欄位 | 值 |
|---|---|
| Duration | 1 週 |
| Sprint goal | 使用者可以本機 `make demo` 端到端跑出 **UC1（Beam Quality Copilot）+ UC2（Handover Runbook）**，並通過 AC-001..AC-004 的 **mock-provider 版**。Real LLM 留 Sprint 2 |
| Demo at sprint review | `make dev-up && scripts/run-demo.sh` 跑出 `tmp/demo-output.json`（通過 schema + AC-004），加上 Grafana 截圖呈現 30 s anomaly visibility |

## Vertical slices（5 + 1 carry-over）

### VS-1 — End-to-end mock copilot answer（2–3d）

**User-visible value**：使用者啟動 `make dev-up` 後，UI 上 Copilot panel 輸入「Which beam is degrading?」可拿到含 evidence block 的回答（mock provider）。

**切到**：scenario-generator（1 sample）→ emulator（snr_db gauge + `/scenarios/load`）→ copilot-api（/healthz + /ask + MockProvider + Pydantic 驗證）→ digital-twin-ui（CopilotPanel + answer + evidence viewer）→ docker-compose（剛好夠 5 service 起來）。

**TDD 紅燈起點**：`services/copilot-api/tests/test_spec_003_red.py::test_ask_with_active_anomaly_cites_metrics`、`services/scenario-generator/tests/test_spec_001_red.py::test_generate_from_template_writes_valid_scenario_json`、`services/ntn-metrics-emulator/tests/test_spec_002_red.py::test_metrics_endpoint_exposes_orbitops_snr_db`。

**Done when**：AC-001（mock）、AC-003.1 自動測試綠；`make dev-up && curl ... /ask` 回 `status: ok`。

### VS-2 — Anomaly visible in Grafana ≤ 30s（1d）

**User-visible value**：使用者 POST `/anomaly/inject` → Grafana dashboard 在 30 s 內呈現 SNR / SINR drop。

**切到**：emulator（多 gauge + `anomaly_active` + `/anomaly/inject`）→ Prometheus（scrape config 含 5s interval、retention）→ Grafana（dashboard JSON 補完整 panels：beam SNR、SINR、latency、Doppler、handover state、anomaly state）。

**Done when**：AC-001 dashboard 部分；30 s SLA 手動驗證 + screenshot。

### VS-3 — 5-step Runbook for handover failure（2d）

**User-visible value**：使用者選 anomaly id → UI 上看到 5 個摺疊 step 的 runbook，每個有 evidence。

**切到**：scenario（handover-failure + gateway-fallback）→ emulator（`handover_failures_total` + `pod_health`）→ copilot-api（/explain + /runbook 強制 5-step Pydantic schema）→ ui（`<RunbookView />` 摺疊 + evidence JSON viewer）。

**TDD 紅燈起點**：`services/copilot-api/tests/test_spec_003_red.py::test_runbook_returns_five_step_structure_with_evidence`。

**Done when**：AC-002、AC-003.1 綠；UI 5 step 順序：What → Why → Action → Risk → Next。

### VS-4 — Hallucination + injection guards（1d）

**User-visible value**：使用者問空 metrics 的 anomaly id → 回 `INSUFFICIENT_EVIDENCE`，**不**幻想；使用者送 jailbreak 字串 → 回應不含 system prompt 內容。

**切到**：copilot-api 內部分支邏輯（PromQL 結果空 → 不呼叫 LLM；prompt template 強制 placeholder；JSON-mode + Pydantic retry-then-degrade）。

**TDD 紅燈起點**：`services/copilot-api/tests/test_spec_003_red.py::test_ask_rejects_prompt_injection_without_revealing_system_prompt`。

**Done when**：AC-003.2 / AC-003.3 / AC-003.4 自動測試綠；security-reviewer + llm-grounding-review skill 全勾。

### VS-5 — Demo replay + golden assertion（1d）

**User-visible value**：`make demo` 一鍵跑：起 stack → 載 scenario → 注 anomaly → 問 copilot → 寫 `tmp/demo-output.json` → 比對 golden expected → screenshot Grafana。

**切到**：scripts/run-demo.sh（trap EXIT 清理 + 30 s health gates + provider fallback to mock）→ emulator（tick seed determinism）→ schema validate → optional Playwright/curl Grafana renderer。

**Done when**：AC-004 全部斷言綠；連跑兩次結果一致。

### VS-6（carry-over，僅當 spare 1d）— Kubernetes real-apply smoke

**User-visible value**：`make kind-up && make k8s-apply` 真起 + 90 s pods Ready + `kubectl exec ... curl localhost:8000/healthz` 綠。

**切到**：Kustomize overlay/local（去 `--dry-run`）→ kind cluster → tests/k8s-smoke 第一個檔。

**Done when**：CI job `k8s-smoke` 綠；Pod livenessProbe 通過。

---

## Acceptance gates（Sprint exit）

- [ ] AC-001（mock）、AC-002、AC-003 全 4 子條、AC-004 自動測試綠（CI 上跑）
- [ ] `make verify` 6/6 綠
- [ ] `make dev-up && scripts/run-demo.sh` 一次性通過
- [ ] `tmp/demo-output.json` 通過 `tests/contracts/copilot-response.schema.json`
- [ ] git history 對每個 vertical slice 有 red commit → green commit 紀錄（TDD audit）
- [ ] backlog 與 PROJECT_STATUS.md 同步更新
- [ ] anonymity gate 全綠（`scripts/check-no-secrets.sh`）

## Risks（從 risk-register 引用 + 本 sprint 新增）

| ID | Risk | Mitigation |
|---|---|---|
| R-01 | LLM 幻想 | VS-1 / VS-4 用 MockProvider 規避真模型；real model 留 Sprint 2 |
| R-04 | 版本漂移（Vite 8 / TS 6 / Tailwind 4） | bootstrap 跑前先 `verify.sh` 比對 GitHub Releases |
| R-09 | 7-14 天時間爆預算 | VS-6 為 carry-over 可移 Sprint 2；如 VS-1 超 3 天，先停 VS-3 改做 VS-4 |
| **NEW R-13** | docker-compose 與 K8s 行為差異 | VS-1 用 compose，VS-6 才碰 kind；契約 schema 鎖住跨環境差異 |
| **NEW R-14** | digital-twin-ui Vite 8 + TS 6 + Tailwind 4 重大版本踩雷 | UI shell 先 build 通過再加功能；任何 plugin 先在 user-level smoke |

## Demo dry-run（sprint review 前一日必排）

依 `scripts/run-demo.sh` 走過完整流程一次；錄 90 秒影片素材；任何 PENDING 都列出來進入 Sprint 2 backlog 或 risk-register。

## Carry-over rule

VS-6 + 任何未完成 slice → 直接搬到 Sprint 2 開頭，不重新估點；搬越 sprint 三次的 slice 必須拆 ADR。
