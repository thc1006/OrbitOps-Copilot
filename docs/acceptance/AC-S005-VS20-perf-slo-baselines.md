# AC-S005-VS20 — Performance SLO baselines + CI gate

| Field | Value |
|---|---|
| Parent SPEC | SPEC-S005-VS20 |
| Sprint | 4 (VS-20) |
| Status | Draft (2026-05-08) |

## Test surfaces

- `tests/perf/emulator-metrics.js` (NEW)
- `tests/perf/copilot-healthz.js` (NEW)
- `tests/perf/copilot-ask.js` (NEW)
- `tests/perf/results/*.json` — gitignored runtime artifacts
- `scripts/perf-smoke.sh` (NEW)
- `verify.sh` §6/6 (NEW advisory section)
- `docs/perf-slo.md` (NEW)
- `.github/workflows/ci.yml` — add `perf-smoke` job

## ACs

### AC-S005-VS20.1 — k6 scripts exist and run
**Given** the 3 k6 scripts under `tests/perf/`,
**When** developer runs `k6 run tests/perf/emulator-metrics.js` against a running compose stack,
**Then** k6 exits 0 and produces JSON summary at `tests/perf/results/emulator-metrics.json`.

### AC-S005-VS20.2 — perf-smoke.sh wrapper
**Given** `scripts/perf-smoke.sh` exists with `set -euo pipefail`,
**When** invoked with compose stack running,
**Then** it runs all 3 k6 scenarios sequentially, parses JSON, prints a summary table, and exits 0 iff all thresholds pass.

### AC-S005-VS20.3 — Threshold breach causes non-zero exit
**Given** any scenario's measured p99 exceeds its declared budget,
**When** perf-smoke.sh runs,
**Then** exit code is non-zero with a clear stderr message naming the breaching scenario + endpoint + measured vs. budget.

### AC-S005-VS20.4 — verify.sh §6/6 advisory gate
**Given** `verify.sh` invoked,
**When** §6/6 runs perf-smoke,
**Then** in **Sprint-4 mode** (`PERF_GATE_BLOCKING=false`, default), failure prints yellow warning but does not exit non-zero from verify.sh; in Sprint-5+ mode (`PERF_GATE_BLOCKING=true`), failure makes verify.sh red.

### AC-S005-VS20.5 — Baseline doc exists
**Given** Sprint-4 close,
**When** `docs/perf-slo.md` opened,
**Then** it contains: SLO table populated with measured numbers (not "TBD"); methodology section (k6 version, scenario config, runner spec); baseline-rerun instructions; budget-change policy paragraph.

### AC-S005-VS20.6 — CI job runs perf-smoke
**Given** PR opened,
**When** CI runs,
**Then** a `perf-smoke` job appears in checks list; runs in < 2 min wall-clock; posts a comment to the PR with the threshold-pass/fail table (Sprint-4: advisory tone, never blocks PR merge).

### AC-S005-VS20.7 — Mock provider for /ask
**Given** copilot-ask.js scenario,
**When** it calls `POST /ask`,
**Then** request hits mock provider path (env `MOCK_PROVIDER_ENABLED=true` in compose); real LLM provider is **never** dialed.

### AC-S005-VS20.8 — JWT auth interaction (Sprint-4 cross-VS)
**Given** SPEC-S003-VS19 lands first in Sprint-4 (VS-19 before VS-20),
**When** copilot-ask.js runs,
**Then** the script obtains a token from mock-oidc at setup and passes it as bearer; OR if VS-20 ships before VS-19, scenarios run with `JWT_REQUIRED=false` (recorded in docs/perf-slo.md as a "Sprint-4 transitional state").

### AC-S005-VS20.9 — NaN-guarded JSON parsing
**Given** k6 JSON output with `"p(99)": null` (zero samples edge case),
**When** perf-smoke.sh parses it,
**Then** the script reports the scenario as "no samples — pre-condition failed" rather than propagating NaN to threshold compare. Anti-pattern Chain #4 enforcement; tested with a fixture.

### AC-S005-VS20.10 — k6 1.0 binary pinned
**Given** Sprint-4 close,
**When** any CI workflow + dev runs `k6 version`,
**Then** version is exactly `v1.0.0`. Dockerfile / workflow YAML pins `grafana/k6:1.0.0` (not `:latest`).

### AC-S005-VS20.11 — AGPL note in docs
**Given** `docs/perf-slo.md`,
**When** searched for "AGPL",
**Then** there is an explicit paragraph stating the license clears OrbitOps usage (test scripts not redistributed).

### AC-S005-VS20.12 — perf-smoke is opt-in for local dev
**Given** developer runs `make verify` locally without docker-compose up,
**When** §6/6 runs,
**Then** it gracefully detects missing compose stack and prints "perf-smoke skipped — start dev stack first" (warn, not fail). No surprise red on first-time contributor.

## Out-of-scope (Sprint-5+)

- Continuous load test against live cluster
- Lighthouse / Web Vitals on UI
- Histogram-based Prometheus alert in Grafana ConfigMap
- Real-LLM endpoint p95 budget (would require provider-side cost / latency profiling)
- Distributed tracing perf (Tempo)
- Rate-limit enforcement (auth-driven)
