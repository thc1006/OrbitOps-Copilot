# PROJECT STATUS

| Field | Value |
|---|---|
| Date | 2026-05-04 |
| Sprint | 1 + 2 (substantively complete; Sprint-3 VS-13 pending) |
| Tier | Sprint-2 P0 + Tier-0 security/EOL/drift all closed; live cluster reflects main; AC-S005-5 met on K8s path |

## Snapshot — current `main` state (after Phase A/B/VS-10c/U7)

### Services in kubeadm `cloudnative-dev-telco` (5 application + 2 observability)

> Phase A (PR #60, 2026-05-03) added Loki + Alloy to the deploy stack. PR #61 + PR #63 finalized the K8s parity. The kubeadm `orbitops` namespace now runs 7 deployments end-to-end Ready (5 application + 2 observability = Loki + Alloy; Prometheus + Grafana count under "application" because they're the demo's first-class observability targets, not log-pipeline plumbing). Verified by `tests/k8s-smoke/healthz.sh` (PR #63).

| Service | Image | Endpoint | Sprint coverage |
|---|---|---|---|
| `ntn-metrics-emulator` | `orbitops/ntn-metrics-emulator:0.1.2-dev-sprint2` | NodePort `:30080` | 9 `orbitops_*` Prometheus gauges; `/scenario/{load,tick,current}` API; **`/anomaly/inject` (PR #51)**; **JSON structured logging via uvicorn-aware setup_logging (PR #62)** |
| `copilot-api` | `orbitops/copilot-api:0.1.2-dev-sprint2` | NodePort `:30081` | `/ask` `/explain` `/runbook` `/healthz` + `/metrics` (G6 RED metrics); `FakeLLMProvider` v2 schema + 4-class anomaly classifier; **`LokiLogScraper` wired into `/ask` evidence (PRs #56 + #57; AC-S005-5 met on K8s path)**; structured JSON logging |
| `digital-twin-ui` | `orbitops/digital-twin-ui:0.1.2-dev-sprint2` | NodePort `:30073` | Material-UI 6 + react-router 6; pages: Overview / Beams / Anomalies (with **inject buttons**, PR #52) / Gateways / Scenarios (Ready-for-Copilot, PR #42) / Copilot (with **evidence sparkline**, PR #58); **3 stacked Recharts time-series panels on Beams (SNR / Latency / Doppler)** (PRs #53–#54) |
| `prometheus` | `prom/prometheus:v3.11.3` | NodePort `:30090` | scrape both services (5 s); **CVE-2025-13465 + CVE-2025-12816 patched (PR #60)** |
| `grafana` | `grafana/grafana:11.4.3` | NodePort `:30030` | OrbitOps Overview dashboard, 8 panels; **CVE-2025-3260 + 3 others patched (PR #60)** |
| `loki` | `grafana/loki:3.4.0` | ClusterIP `:3100` | log store; receives logs from Alloy; copilot's `LokiLogScraper` queries here for `/ask` evidence augmentation (PR #56 / #60 / #61) |
| `alloy` | `grafana/alloy:v1.6.1` | (internal) | replaces EOL promtail (ADR-010); discovers OrbitOps pods via K8s API (`role=pod`) and ships container stdout to Loki; namespace-scoped Role for `pods + pods/log` (PRs #60 / #61) |

### Backend metrics + log contract

9 canonical gauges in `docs/contracts/metrics.md` §3:

```
orbitops_beam_snr_db          orbitops_beam_sinr_db
orbitops_link_latency_ms      orbitops_packet_loss_ratio
orbitops_doppler_residual_hz  orbitops_handover_state
orbitops_gateway_available    orbitops_anomaly_active
orbitops_beam_elevation_deg                          ← G7 (PR #34)
```

Source-of-truth = `tests/contracts/metrics.schema.json`. `scripts/check-observability.sh` enforces dashboard parity (CI tripwire).

LogQL contract: `{service=~"orbitops-.*"}` — Alloy prepends `orbitops-` prefix to `app.kubernetes.io/name` so K8s + docker-compose paths produce identical service labels. `LokiLogScraper.fetch_recent(since_seconds)` queries Loki via `/loki/api/v1/query_range`; defensive parser skips malformed value pairs (PR #56 round-2 review).

### Tests + gates (all green on 2026-05-04 main)

| Layer | Result |
|---|---|
| `pytest services/ tests/` | **122 passed + 1 xfail-strict** (voice-interface S2-07; user-skipped) |
| `vitest` (UI) | **83 passed** across 11 test files |
| `./verify.sh` | **5b/5 gates green** (lint blocking / unit / no-secrets / observability / schemas / scenario mirror / k8s manifests / **helm chart + ADR-009 service-name contract**) |
| GitHub Actions CI | **9/9 SUCCESS** (verify / ruff / **claims-audit (PR #63)** / anonymity / schema / k8s manifest / docker compose build / **tdd discipline (PR #49)** / ui build) |
| `tests/k8s-smoke/healthz.sh` | 7/7 deployments Ready in <90s; 3/3 /healthz 200 (verified live 2026-05-04) |
| Live `/ask` E2E on K8s | `status=ok`, `metrics_used=1`, **`logs_used=100`** (AC-S005-5 met on K8s path; PRs #57+#60+#61) |

## Sprint 2 — what shipped (chronological after PROJECT_STATUS's prior 2026-05-02 snapshot)

| Phase / VS | PR | What |
|---|---|---|
| Phase H.1 — UI completeness sweep | #45 | Beams elevation column / Anomalies dictionary covers 5 producer events / 3-scenario UI loadability / Copilot full-evidence display + 14 contract tests |
| Tier 3 — UI CI job + 7 SPECs Draft → Accepted | #46 | UI vitest + tsc CI job; SPECs flipped status |
| **Phase H.2 — Helm full templates** (VS-7 partial) | #47 | UI / Prom / Grafana templates added; 5 svc total |
| **ADR-009 — Helm service-name strategy** (VS-7 closure) | #48 | Service `metadata.name` mirrors Kustomize bare names; chart works alongside ConfigMap-hardcoded DNS targets; ADR-009 service-name contract test in verify.sh 5b/5 |
| **TDD red→green CI gate** (closes I-3) | #49 | `tdd-discipline` blocking job on PR; in-scope filter + escape hatch + self-test |
| **VS-11 — ArgoCD App reference** | #50 | `deploy/argocd/orbitops-copilot.yaml` Kustomize-driven Application; opt-in usage |
| **VS-9a — emulator `/anomaly/inject` API** | #51 | mutates loaded scenario; defaults beam-1; idempotent; fractional-duration preserve; 10 contract tests |
| **VS-9b.1 — Anomalies inject UI** | #52 | 5 buttons + injectAnomaly typed wrapper + 5s AbortController timeout |
| **VS-9b.2 — Recharts SNR + useMetricsHistory** | #53 | sliding-window hook + LineChart on Beams; StrictMode-safe; maxSize=0 guard |
| **VS-9b.3 — multi-metric chart** | #54 | BeamSnrChart → BeamMetricChart; 3 stacked panels (SNR/Latency/Doppler) |
| **VS-10a — structured JSON logging** (closes I-9) | #55 | per-service `_logging.py` JsonFormatter; closed I-9 |
| **VS-10b.1 — Loki + LogScraper foundation** | #56 | Loki + promtail compose; LokiLogScraper class + 8 contract tests; defensive parse |
| **VS-10b.2 — wire LogScraper into /ask** (AC-S005-5) | #57 | evidence.logs_used populates from Loki; graceful degrade on Loki failure |
| **VS-9b.4 — Copilot evidence sparkline** | #58 | inline MetricSparkline; theme-color fix; 1-point invisible-chart guard |
| Sprint-2 housekeeping (closes I-4/I-9 docs) | #59 | doc-drift cleanup; ADR-006/7/8/9 indexed in docs/04 |
| **Phase A — Tier-0 security / EOL / drift** | #60 | Prom 3.5→3.11.3 (2 high CVE) / Grafana 11.4.0→11.4.3 (4 CVE) / promtail→Alloy v1.6.1 (EOL; ADR-010) / image bump 0.1.1-dev-g6g7g8→0.1.2-dev-sprint2 / Loki+Alloy K8s overlay parity |
| **U7 — Alloy K8s discovery + ORBITOPS_LOKI_URL** | #61 | live-cluster verification fixes; first time logs_used=100 on K8s path |
| **VS-10c — uvicorn-aware setup_logging** | #62 | clears uvicorn-namespace handlers + propagates to root JsonFormatter; pod stdout JSON-only |
| **Phase B — 5 issues batch (I-5/I-6/I-8/I-10/I-11)** | #63 | ruff blocking; Grafana prod overlay template; k8s-smoke healthz.sh; claims-audit CI job; lock-file glob |
| Phase D — todo_list refresh | #64 | end-of-cycle housekeeping |

**21 PRs shipped** Sprint-2 (#44–#64).

## Issues snapshot (post-Phase B)

| Severity | Count | Detail |
|---|---|---|
| RETIRED | 2 | I-1, I-2 (anonymity policy reversal 2026-05-01) |
| RESOLVED | 8 | I-3, I-4, I-5, I-6, I-8, I-9, I-10, I-11 |
| Open by-design | 2 | I-7 (VS-12 voice; user-skipped, no GPU), I-12 (VS-8 LLM; user-skipped, no GPU) |

## What's next

| Tier | ID | Item | Est | Risk |
|---|---|---|---|---|
| P1 | S1.0–S4 | VS-13 CesiumJS pass viz + Sprint-3 stack bump (React 19 / Vite 8 / TS 6 / Vitest 4 / @testing-library 16.3.2 / Recharts 3 / router 7 / Node 22) | 1-2 days | High (5 majors) |
| P1 | S5 | VS-17 Nephio kpt full doc | 0.5d | Low |
| P3 | T1 | i18n migration (AC-S004-5) | 2-3 hr | Medium (in-scope TDD) |
| P3 | T4 | README CLI examples | 30 min | Low |
| P4 | — | Risk register R-01..R-12 walk-through | half day | Low (mostly docs) |

User-skipped (out of scope): VS-8 LLM, VS-12 voice, VS-14/15/16/18 投件 deliverables.

## Health gates

- `make verify` (≡ `./verify.sh`) runs 8 blocking gates + 2 advisory:
  - **Blocking**: 1/5 lint (ruff, blocking since I-5 PR #63) → 2/5 unit tests → 3/5 real-secrets scan → 3b/5 observability stack → 3c/5 scenario JSON ↔ UI mirror → 4/5 JSON schema validation → 5/5 k8s manifest validation → 5b/5 helm chart lint + template + ADR-009 service-name contract.
  - **Advisory** (warn only): 1b TDD-discipline audit (the blocking variant runs in CI's `tdd-discipline` job per PR #49) + 1c claims-audit marketing-word grep (the blocking variant runs in CI's `claims-audit` job per PR #63).
- `make k8s-reload-observability` (PR #40) — re-applies kustomize overlay + restarts Grafana/Prometheus.
- `tests/k8s-smoke/healthz.sh` (PR #63) — live-cluster smoke on all 7 deployments.
- CI runs 9 jobs on every push (was 6 pre-Sprint-2; +tdd-discipline +claims-audit +ui-build).

## Risk highlights

- **R-01** LLM hallucination — mitigated by evidence schema (ADR-004); FakeLLMProvider only consumes typed `Evidence`; out-of-domain input → REFUSED; empty evidence → INSUFFICIENT_EVIDENCE.
- **R-03** Anonymity leak — `scripts/check-no-secrets.sh` (real-secret scan only since 2026-05-01 policy relaxation) + CI gate; submission-archive scrub remains a process step.
- **R-04** 版本漂移 — ADR-008 pinned Sprint-1 frontend; Phase A (PR #60) closed CVE/EOL gap; remaining VS-13.x stack-bump risk acknowledged.
- **R-09** 7–14 day budget — Sprint 1 + Sprint 2 P0 fit; pitch/video out of scope per user no-投件 policy.
