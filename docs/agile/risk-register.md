# Risk Register

> 持續更新；每個 sprint review 必檢視。Score = Likelihood × Impact（1-5 each；max 25）。

| ID | Risk | L | I | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-01 | LLM 幻想／越獄／未引用 evidence | 4 | 5 | 20 | 強制 evidence schema、grounding test、injection test、temperature ≤ 0.3、JSON-mode | llm-copilot-engineer | Open |
| R-02 | 評審期待真 RF/SDR 整合 | 3 | 4 | 12 | 投影片明示 P0 範圍；P2 路線寫明 Sionna RT/AODT/真 RAN | architect | Open |
| R-03 | 匿名性外洩（commit author / metadata / UI 截圖） | 3 | 5 | 15 | check-no-secrets.sh + exiftool + CI 阻擋 + PR review | security-reviewer | Open |
| R-04 | 版本漂移（Helm 4 / Vite 8 / TS 6 / Tailwind 4 重大版本踩雷） | 2 | 3 | 6 | verify.sh 每次 install 前比對；docs/09 列 breaking change；lockfile 鎖版本；3 sprints 跑 5+ 週無 breaking 事故 | k8s-platform-engineer | Mitigated（2026-05-07，sprint-03-review） |
| R-05 | AODT OSS 釋出延期（公告 2026-03） | 3 | 2 | 6 | 列為 P2，不擋 MVP | researcher | Open |
| R-06 | scenario 與 3GPP Rel-19 用詞漂移 | 2 | 4 | 8 | ran-ntn-engineer 校對；docs 引用 Ericsson NTN payload blog | ran-ntn-engineer | Open |
| R-07 | docker-compose ≠ K8s 行為差異 | 3 | 3 | 9 | CI 跑 manifest validation；kind smoke test | k8s-platform-engineer | Open |
| R-08 | 真 LLM endpoint 在評審現場斷線 | 3 | 4 | 12 | mock provider 永遠可用作 fallback；demo 影片預錄 | llm-copilot-engineer | Open |
| R-09 | 7-14 天時間爆預算 | 1 | 5 | 5 | vertical slice 1-2 天；Sprint 1 嚴格守 P0 範圍；3 sprints 跑完 50+ PR 全在預算 | architect | Mitigated（2026-05-07，sprint-03-review） |
| R-10 | RunSpace 評分標準變動 | — | — | — | 已不適用：user 於 2026-05-04 撤回 RunSpace 投件（user_skip_rules.md），VS-14/15/16/18 全 skip | architect | Closed（2026-05-07，sprint-03-review） |
| R-11 | open-source 授權衝突（AGPL: srsRAN/Open5GS/Grafana/Loki/Tempo） | 2 | 3 | 6 | 不發行 SaaS；docs/10 列各依賴授權 | security-reviewer | Open |
| R-12 | hooks 誤刪檔 / 自動 push | 2 | 5 | 10 | settings.json 安全保守；CI 審 hook diff；禁止 rm/curl/git push hooks | security-reviewer | Mitigated |
| R-13 | Single-contributor PR train review fatigue（PR #88 8-commit chase 為實證） | 4 | 3 | 12 | `docs/reviews/anti-pattern-checklist.md` 7+1 chain self-audit；`.github/pull_request_template.md` 強制 PR body 欄位；CLAUDE.md §13.3 hook；Chain #X process rule（visual-bug 先寫測試）；PR #89 是首次 dogfood 案例 | architect | Mitigated（2026-05-07，PR #89 引入） |
| R-14 | copilot-api auth boundary requires JWKS IdP at call time — IdP outage = auth failure for all LLM endpoints | 2 | 4 | 8 | 1h grace TTL on last-known-good JWKS; `JWT_REQUIRED=false` dev escape; mock-oidc healthcheck gated in compose depends_on; /healthz stays public for K8s probes | llm-copilot-engineer | Open（2026-07-02，Sprint-4） |
| S4-R4 | VS-19 先於 VS-20 land（perf 測 /ask 需 token）若反了進 transitional state | — | — | — | Resolved: perf-smoke uses JWT_REQUIRED=false transitional bypass; documented in docs/perf-slo.md | architect | Closed（2026-07-02，Sprint-4） |

## 退出條件

每個 risk 的 Score 降至 ≤ 6 或 status 標記 `Closed/Mitigated`。
