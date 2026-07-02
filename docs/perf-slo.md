# VS-20 Performance SLO Baselines

> Last measured: 2026-07-02  
> k6 version: see `k6 version` output  
> Environment: local single-node (uvicorn single-worker, loopback 127.0.0.1)

---

## 1. Measured baselines

All numbers are from `k6 run --summary-trend-stats="med,p(95),p(99)"` at steady load.
Values are in **milliseconds (ms)**.

| Scenario | Load | p(50) / med | p(95) | p(99) | Error rate |
|---|---|---|---|---|---|
| emulator `GET /metrics` | 100 RPS × 30 s | 0.65 | 1.22 | 1.64 | 0.00 % |
| copilot `GET /healthz` | 100 RPS × 30 s | 0.79 | 1.44 | 3.76 | 0.00 % |
| copilot `POST /ask` | 5 RPS × 30 s | 2.17 | 2.53 | 6.75 | 0.00 % |

> `/ask` was tested with `JWT_REQUIRED=false` (FakeLLMProvider, no real LLM call).
> With JWT enabled and a real RS256 JWKS endpoint, expect +1–5 ms per request.

---

## 2. SLO thresholds (CI gates)

Thresholds are set at **2× the measured baseline** so that a 2× regression in
any percentile will fail CI. The multiplier is conservative; a production P0
alert would typically fire at 1.5×.

| Scenario | k6 threshold | Threshold (ms) | Headroom vs measured |
|---|---|---|---|
| emulator `GET /metrics` | `p(95)<3` | 3 | 2.4× (measured 1.22) |
| emulator `GET /metrics` | `p(99)<4` | 4 | 2.4× (measured 1.64) |
| copilot `GET /healthz` | `p(95)<4` | 4 | 2.1× (measured 1.88) |
| copilot `GET /healthz` | `p(99)<8` | 8 | 2.1× (measured 3.76) |
| copilot `POST /ask` | `p(95)<7` | 7 | 2.1× (measured 3.39) |
| copilot `POST /ask` | `p(99)<15` | 15 | 2.2× (measured 6.75) |

> Note: the p(99) for `/healthz` varied between 3.76 ms and 5.59 ms across runs.
> The threshold of 8 ms allows for this variance. If p(99) consistently exceeds
> 5 ms under normal conditions, re-measure and adjust the threshold.

---

## 3. How to run

### Prerequisites

Services must be running before invoking the smoke script:

```bash
# Emulator (example using an unprivileged port):
JWT_REQUIRED=false .venv/bin/uvicorn ntn_metrics_emulator.main:app \
  --host 127.0.0.1 --port 30080 &

# Copilot-api:
JWT_REQUIRED=false .venv/bin/uvicorn copilot_api.main:app \
  --host 127.0.0.1 --port 30081 &
```

### Run

```bash
# Against default ports (30080 / 30081):
./scripts/perf-smoke.sh

# Override base URLs:
EMULATOR_BASE=http://emulator-svc:8000 \
COPILOT_BASE=http://copilot-svc:8001 \
./scripts/perf-smoke.sh
```

Results JSON files land in `tests/perf/results/` (excluded from git; see `.gitignore`).

---

## 4. Methodology

### Test tool

k6 v0.55+ (installed at `/usr/local/bin/k6`). Open-source load testing tool;
no external SaaS dependency.

### Scenario configuration

| Parameter | emulator /metrics | copilot /healthz | copilot /ask |
|---|---|---|---|
| Executor | constant-arrival-rate | constant-arrival-rate | constant-arrival-rate |
| Rate | 100 iter/s | 100 iter/s | 5 iter/s |
| Duration | 30 s | 30 s | 30 s |
| Pre-allocated VUs | 20 | 20 | 5 |
| Max VUs | 50 | 50 | 20 |

### Test environment (baseline measurement)

- Host: single Linux node (amd64, Debian 13)
- Transport: loopback (127.0.0.1) — no real network overhead
- Python runtime: CPython 3.13, uvicorn single-worker (no Gunicorn)
- Backend: FakeLLMProvider (synchronous, deterministic; no LLM I/O)
- Load source: k6 on the same host

Loopback measurements are a **lower bound** for deployed latency. Expect
+2–20 ms of network overhead in a real cluster depending on CNI and sidecar
(Envoy/Linkerd) configuration.

---

## 5. SLO budget rules

1. **Thresholds may not be adjusted without a new measurement run.** If a code
   change causes a threshold breach, either fix the regression or re-run the
   baseline to establish a new budget and update the threshold in the k6 script
   AND this document in the same commit.

2. **Multiplier is 2×.** Reducing the multiplier below 1.5× requires explicit
   sign-off in an ADR (`docs/adr/`).

3. **Error rate thresholds** are hard at `<1%` for stateless endpoints and
   `<5%` for `/ask` (higher because LLM providers may return 5xx transiently).
   These must not be relaxed without a documented reason.

4. **Re-measurement cadence:** run the baseline again whenever:
   - A new middleware layer is introduced (auth, tracing, logging)
   - The FastAPI version is upgraded
   - The test environment changes (more workers, different hardware)
   - A threshold breach is observed in CI

---

## 6. k6 script locations

| Script | Path |
|---|---|
| emulator /metrics | `tests/perf/emulator-metrics.js` |
| copilot /healthz | `tests/perf/copilot-healthz.js` |
| copilot /ask | `tests/perf/copilot-ask.js` |
| Smoke runner | `scripts/perf-smoke.sh` |
| Result artifacts | `tests/perf/results/` (gitignored) |
