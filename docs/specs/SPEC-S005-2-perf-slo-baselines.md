# SPEC-S005-2 — Performance SLO baselines + CI gate

| Field | Value |
|---|---|
| Status | Draft (2026-05-08) — Sprint-4 VS-20 candidate |
| Parent | SPEC-005 (observability) |
| Owner | observability-engineer + release-engineer |
| Sprint | 4 (VS-20) |
| Depends on | SPEC-002 (emulator), SPEC-003 (copilot-api) |
| Related ACs | AC-S005-2 |
| Research basis | `docs/00_research_2026_04.md` §"Sprint-4 技術選型 T2" (2026-05-08) |

## 1. Goal

emulator 與 copilot-api 的 latency-critical endpoint 進入 **CI-enforced SLO budget**。任一 endpoint regression（例如後續 PR 加重 evidence collection logic 把 `/ask` p95 拖過 budget）→ CI 紅燈擋下。Sprint-4 的 SLO 數字**用 measure-first 方式產生**，不憑空寫死。

## 2. Non-goals

- **Continuous load test on production cluster**：本 SPEC 只規範 CI-time + dev-time HTTP scenario；不打 live cluster。
- **Synthetic monitoring at edge**：用 Prometheus blackbox exporter 跑 24/7 monitoring 屬 Sprint-5+。
- **Distributed tracing perf** (Tempo)：SPEC-005 已標 deferred；本 SPEC 不處理。
- **Real-LLM endpoint perf**：mock provider only。Real LLM 會有 wall-clock 5-30s wait time，不適合 SLO budget。
- **Load gen against UI** (Lighthouse / WebPageTest)：UI 是 React SPA，client-side perf 走另一條 Web Vitals path（Sprint-5+）。

## 3. Inputs (current state, 2026-05-08)

- 無 perf gate；`verify.sh` §1–§5d 不含 perf 測試。
- 無 baseline 數據；`docs/05_validation_plan.md` 提到「期望 30s anomaly visibility」但無 latency budget。
- copilot-api `/ask` 在 `tests/golden/*.expected.json` 有 functional assertion，無 latency assertion。
- emulator `/metrics` 跑 `prometheus_client` exposition；目前 Prom 5s scrape 沒有 lag observed in 3-sprint demo。
- CI runners：GitHub Actions Linux runners (≈ 2 vCPU, 7 GB RAM, ubuntu-latest)。

## 4. Outputs (target state)

### 4.1 k6 OSS 1.0 in repo
- Script directory: `tests/perf/`
  - `tests/perf/emulator-metrics.js` — `GET /metrics`，constant 100 RPS × 30s
  - `tests/perf/copilot-healthz.js` — `GET /healthz`，constant 100 RPS × 30s
  - `tests/perf/copilot-ask.js` — `POST /ask` with mock provider，constant 5 RPS × 30s
- 每 script 含 `thresholds`（k6 native pass/fail gate）。**初始 threshold 由 baseline 量測決定，不寫死於 SPEC**。
- 輸出: `--out json=tests/perf/results/<scenario>.json`

### 4.2 Wrapper script
- `scripts/perf-smoke.sh`：
  - 起 docker-compose 起 emulator + copilot + mock-oidc（SPEC-S003-2 dep；若無 token，`JWT_REQUIRED=false` 跳過）
  - 跑 3 個 k6 script
  - 解析 JSON，斷言 thresholds 全 pass
  - 輸出 summary 表格（p50/p95/p99 + RPS + error rate）
- exit code: 0 = pass，非 0 = 任一 SLO breach

### 4.3 verify.sh §6/6 — perf advisory gate
- 新增 §6/6：跑 `scripts/perf-smoke.sh`
- **Sprint-4: advisory mode**（warn-not-fail；CI yellow line）— 因為 baseline 還在校準
- **Sprint-5+: 升 blocking** 一旦 baseline stable + CI runner 行為一致

### 4.4 baseline 文件
- `docs/perf-slo.md`（NEW）：
  - SLO 表（每個 endpoint 的 p50/p95/p99 budget + breach 行為）
  - Methodology（k6 version、scenario 設定、CI runner spec）
  - Baseline measure 程序（如何重新跑出新 budget）
  - 「**budget 不能憑空調整**」規則：要動 SLO 必須附 PR 說明 measurement re-run 結果

### 4.5 CI integration
- `.github/workflows/ci.yml` 加 job `perf-smoke`：
  - Trigger: 每 PR + 每 push to main
  - Image: `grafana/k6:1.0.0`
  - Time budget: < 2 min total（3 scenarios × 30s + warmup + parse）
  - 報告: post threshold table to PR comment（advisory tone in Sprint-4）

## 5. Interfaces

### 5.1 k6 threshold config (initial; final values measured at impl time)
```javascript
// emulator-metrics.js — placeholder thresholds; UPDATE after baseline measurement
export const options = {
  scenarios: {
    constant_100rps: {
      executor: 'constant-arrival-rate',
      rate: 100, timeUnit: '1s', duration: '30s',
      preAllocatedVUs: 20, maxVUs: 50,
    },
  },
  thresholds: {
    'http_req_duration{scenario:default}': ['p(99)<200'],  // PLACEHOLDER — measure first
    'http_req_failed': ['rate<0.01'],
  },
};
```

### 5.2 perf-smoke output schema
```json
{
  "scenario": "emulator-metrics",
  "p50_ms": <number>, "p95_ms": <number>, "p99_ms": <number>,
  "rps": <number>, "error_rate": <number>,
  "budget_p99_ms": <number>, "passed": <bool>
}
```

### 5.3 SLO budget table (initial; populate during impl)
| Scenario | Endpoint | RPS | Duration | p50 budget | p95 budget | p99 budget | Error budget |
|---|---|---|---|---|---|---|---|
| emulator-metrics | `GET /metrics` | 100 | 30s | TBD-measure | TBD | TBD | < 1% |
| copilot-healthz | `GET /healthz` | 100 | 30s | TBD-measure | TBD | TBD | < 1% |
| copilot-ask | `POST /ask` (mock) | 5 | 30s | TBD-measure | TBD | TBD | < 1% |

## 6. Constraints

- **k6 1.0 OSS only**, no `k6 cloud` features (paid).
- **AGPL-3.0**: test scripts 不需公開（AGPL 只約束修改 k6 binary 後散布）。docs/perf-slo.md 寫明此事。
- **Mock provider only** for `/ask`：real LLM excluded from SLO（5-30s wall-clock 不可控）。
- **CI runner** baseline：必須在 ubuntu-latest 跑。本機數字（dev machine）只當「sanity check」，**不能** 拿來定 budget。
- **Anti-pattern Chain #1 (grep-verify)**：SLO budget 數字必須有實際 k6 run 結果支撐，禁止「我覺得應該夠」式憑感覺定數。
- **Anti-pattern Chain #4 (NaN guard)**: perf-smoke.sh 解析 k6 JSON 必須 guard `null` / `undefined` p99 (k6 在 0 sample 場景會回 null)，不可 propagate NaN to threshold compare。
- **Time budget**：CI total 加 perf-smoke ≤ 2 min；超出必須 trim scenario duration 或拆 background workflow。

## 7. Open questions (resolve at impl)

1. **k6 vs scripts/stress.js (existing js)**: 既有 `scripts/stress.js` 是 k6 script？若是，是否複用？— SPEC: 若 stress.js 是 k6，merge 進 `tests/perf/`；若 raw node，rewrite 成 k6 1.0 syntax。
2. **CI runner 數字 vs dev machine 數字**: dev 比 CI 快 2-5x 是常態；budget 鎖 CI 數字。文件 docs/perf-slo.md 寫明此 caveat。
3. **Allow re-run on flaky CI**: 因 GitHub runner noisy neighbour 可能造成偽 breach。Sprint-4 advisory 模式不擋；Sprint-5 升 blocking 時加 retry-once 邏輯。
4. **Histogram in Grafana**: 是否同時加 Prom histogram alert（`histogram_quantile`）作為 production-side SLO？— 此 SPEC 不擋，但建議 Sprint-5 補。

## 8. Acceptance criteria

See `docs/acceptance/AC-S005-2-perf-slo-baselines.md`.

## 9. Anti-pattern accountability

- **Chain #1 grep-verify**: SLO budget 數字以 measurement 為依據；SPEC 內所有 placeholder 在 impl PR 必須填實測。
- **Chain #4 NaN guard**: perf-smoke.sh JSON parser 必驗 `Number.isFinite` analogue (Python `math.isfinite`)。
- **Chain #X (process)**: 是 visual-regression 的 perf 對應 — endpoint 變慢的 PR 必須跑 perf-smoke 紅燈再修，不要讓「I think it's still fine」混過。

## 10. Sources

See `docs/00_research_2026_04.md` §"Sprint-4 技術選型 T2" (2026-05-08).
