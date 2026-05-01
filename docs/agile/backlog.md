# Backlog (vertical slices)

> **每個 item 為 vertical slice**：cuts through scenario → emulator → copilot → UI → obs → deploy 之中的多層，且結束時有可被使用者觀察的價值（不是「先做完全 backend」這種水平切法）。
> 1–2 天 / slice；超過 2 天必須再切片或先寫拆分 ADR。

## Sprint 0（已完成 — bootstrap，2026-04-30）

- [x] repo skeleton + CLAUDE.md + AGENTS.md + 工程憲法（SDD/TDD/Agile）
- [x] Phase 1 研究 `docs/00_research_2026_04.md`
- [x] Phase 2 docs `docs/01..10`
- [x] 8 個 SPEC（含 SPEC-000）+ 4 個 AC + 5 個 ADR
- [x] tests/contracts 三 schema、tests/golden 三 expected
- [x] verify.sh / test.sh / Makefile / CI 6-gate
- [x] 10 個 Skill + 10 個 Agent + 7 個 Slash command + skill-candidates
- [x] MCP needs analysis / candidates / security review / install plan / decision record（`docs/mcp/00..04`）
- [x] Sprint 0 install event：0 個 MCP 安裝（按 plan）

## Sprint 1（P0 critical path — 5 vertical slices）

> Sprint goal：**「使用者可以本機 `make demo` 端到端跑出 UC1（Beam Quality Copilot）+ UC2（Handover Runbook）並通過 AC-001..AC-004 的 mock-provider 版」**。

| ID | Vertical Slice | 切到的層 | 估 | Owner | SPEC | AC |
|---|---|---|---|---|---|---|
| **VS-1** | End-to-end mock copilot answer | scenario(1) → emulator(snr_db + scenario load) → copilot-api(/ask + MockProvider + evidence schema) → ui(CopilotPanel + 顯示 evidence) → docker-compose | 2–3d | ran-ntn + llm + arch | 001/002/003/004/006 | AC-001（mock）, AC-003.1 |
| **VS-2** | Anomaly visible in Grafana ≤ 30s | emulator(`anomaly_active` + 多 gauge + inject endpoint) → Prometheus(scrape + retention) → Grafana(dashboard JSON 完整化) | 1d | obs + ran-ntn | 002/005 | AC-001（dashboard） |
| **VS-3** | 5-step Runbook for handover failure | scenario(handover-failure) → emulator(`handover_failures_total` + `pod_health`) → copilot-api(/explain + /runbook 5-step) → ui(`RunbookView` 摺疊) | 2d | llm + ran-ntn + arch | 001/002/003/004 | AC-002, AC-003.1 |
| **VS-4** | Hallucination + injection guards | copilot-api(空 metrics → INSUFFICIENT_EVIDENCE 分支 + prompt injection sanitization + schema retry-then-degrade) | 1d | llm + security-reviewer | 003 | AC-003.2/3/4 |
| **VS-5** | Demo replay + golden assertion | scripts/run-demo.sh trap-EXIT 強化 + emulator tick seed determinism + `tmp/demo-output.json` schema 驗證 + Grafana 截圖 hook | 1d | arch + release | 007 | AC-004 |

**Sprint 1 carry-over candidate（≤ 1 day spare 才做）**

| ID | Vertical Slice | 切到的層 | 估 |
|---|---|---|---|
| VS-6 | Kubernetes real-apply smoke | Kustomize（移除 `--dry-run`）→ kind cluster → curl `/healthz` 從 cluster 內 | 1d |
| VS-7 | `make k8s-reload-observability` 防 obs ConfigMap 漂移 | Makefile 多一個 target = `kustomize build … \| kubectl apply -f -` + `kubectl rollout restart deploy/{grafana,prometheus}`；任何 PR 改 `observability/**` 後跑一次。Driver: PR #34 elevation panel 漂移事件（live ConfigMap 7 panel vs git 8 panel；docs/reviews/demo-path-audit-2026-05-01.md 有完整紀錄） | 0.5d |
| VS-8 | UI「Ready for Copilot」affordance | Scenarios 頁多一個 "Load + tick into anomaly" 一鍵 button，避免 demo 時 evaluator 漏跑 step 1+2 看到 INSUFFICIENT_EVIDENCE 誤以為 Copilot 壞掉。Driver: 同上 audit 文件「UX nit」段。或退而求其次更新 `docs/08_demo_script_3min.md` 寫死 4-step click flow。 | 0.5–1d |

## Sprint 2（P0 完整 + P1 起步 — 6 vertical slices）

> Sprint goal：**「Sprint 1 demo 可在 K8s 上跑、可接真 LLM、可看時序圖、可接語音輸入」**。

| ID | Vertical Slice | 切到的層 | 估 | SPEC |
|---|---|---|---|---|
| **VS-6** | Kubernetes real-apply smoke（如 Sprint 1 未做完） | Kustomize + kind + smoke | 1d | 006 |
| **VS-7** | Helm chart real | Helm chart values + `helm install --dry-run` 通過 + chart-test pod | 1d | 006 |
| **VS-8** | Real LLM endpoint + Ollama Qwen3.6 smoke | copilot-api(OpenAICompatibleProvider) + Ollama in compose + 單元 grounding test 對 real model | 2d | 003 |
| **VS-9** | UI time-series + anomaly inject button | digital-twin-ui(Recharts 時序圖 + 「inject anomaly」按鈕呼叫 emulator) | 2d | 004 |
| **VS-10** | Loki mock-logs integration | Loki in compose + emulator/copilot/UI mock log 寫入 + copilot-api 從 Loki 拉 evidence | 1d | 003/005 |
| **VS-11** | ArgoCD App reference | `deploy/k8s/base/argocd-app.yaml` + 文件說明（不需 mgmt cluster） | 1d | 006 |
| **VS-12** | Voice interface stub | services/voice-interface(faster-whisper 1.2.1 接口 stub + Pydantic) + UI 語音按鈕（後端 stub） | 1d | 003 |

## Sprint 3（P1 + RunSpace 簡報 — 5 vertical slices）

> Sprint goal：**「RunSpace 提交完成（10 頁簡報 + 90s 影片 + 3min 影片 + zip 包裝）」**。

| ID | Vertical Slice | 切到的層 | 估 | SPEC |
|---|---|---|---|---|
| **VS-13** | CesiumJS satellite pass viz | digital-twin-ui(CesiumJS 1.140 + pass animation + beam coverage cone) | 2d | 004 |
| **VS-14** | RunSpace 10-page slide | docs/06_runspace_pitch_outline.md → 真 .pdf + claims-audit 全 pass | 1d | 007 |
| **VS-15** | 90s demo video | docs/07_demo_script_90s.md → 真 .mp4 + exiftool 清 metadata | 1d | 007 |
| **VS-16** | 3min English-subtitled video | docs/08_demo_script_3min.md → 真 .mp4 + 英文字幕 .srt | 1d | 007 |
| **VS-17** | Nephio kpt package full doc | packages/nephio-stubs/ 文件化 + kpt fn render dry-run | 0.5d | 006 |
| **VS-18** | Pre-submission claims audit + zip | claims-audit skill 全 pass + `make archive` + DoD §3.4 全 checked | 0.5d | 007 |

## Backlog（暫不排，待 P2/P3）

- 真 OAI / srsRAN NTN wrapper（emulator → real RAN stack）
- Sionna RT v2.0.1 channel coefficient 注入
- AODT 整合（待官方 GitHub repo URL 釋出後評估）
- Closed-loop GitOps reconcile（copilot 建議 → ArgoCD apply → 觀察）
- Multi-language UI（zh-TW、en、ja）
- Real Nephio R5 mgmt cluster + Porch lifecycle
- Production-grade authn/authz（OIDC + JWT）
- LLM provider eval harness（Ollama vs vLLM vs OpenAI grounding 對比）

---

## 縱切片矩陣（Sprint 1 visualised — 為何這是 vertical 不是 horizontal）

```
                   scenario  emulator  copilot  ui   obs   deploy
                   --------- --------- -------- ---- ----- -------
VS-1 mock e2e      ●         ●(snr)    ●(/ask)  ●    ·     ●(compose)
VS-2 grafana 30s   ·         ●(inject) ·        ·    ●     ·
VS-3 runbook       ●(ho/gw)  ●(ho/pod) ●(/run)  ●    ·     ·
VS-4 guards        ·         ·         ●        ·    ·     ·
VS-5 demo replay   ·         ●(seed)   ·        ·    ●(ss) ·
VS-6 k8s smoke     ·         ·         ·        ·    ·     ●(kind)
```

**對比之前的水平切法**（已替換）：
```
S1-01 only scenario     S1-02 only emulator       S1-04 only copilot
S1-06 only ui           S1-07 only obs            S1-09 only k8s
```
水平切法在 sprint 中段 user 看不到任何完整流程；vertical 每個 slice 結束都可被觀察、可錄 demo。

---

## 規格／驗收 / ADR 對應總表

| Slice | SPEC | AC | ADR |
|---|---|---|---|
| VS-1 | 001/002/003/004/006 | AC-001（mock）、AC-003.1 | 001/002/003/004 |
| VS-2 | 002/005 | AC-001（dashboard） | 003 |
| VS-3 | 001/002/003/004 | AC-002、AC-003.1 | 001/004 |
| VS-4 | 003 | AC-003.2/3/4 | 004 |
| VS-5 | 002/007 | AC-004 | 001 |
| VS-6 | 006 | (SPEC-006) | 005 |
| VS-7 | 006 | (SPEC-006) | 005 |
| VS-8 | 003 | AC-003 全 | 004 |
| VS-9 | 004 | AC-001/002（UI） | 002 |
| VS-10 | 003/005 | AC-002（logs） | 003 |
| VS-11 | 006 | (SPEC-006) | 005 |
| VS-12 | 003 | (UC1 voice optional) | — |
| VS-13 | 004 | (UC1 viz) | 002 |
| VS-14..18 | 007 | AC-004 | — |
