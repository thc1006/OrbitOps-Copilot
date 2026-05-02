# PROJECT STATUS

| Field | Value |
|---|---|
| Date | 2026-05-02 |
| Sprint | 1 (substantively complete) → 2 (planned) |
| Tier | Sprint 1 P0 demo path live in cluster + 7-phase post-merge audit cycle complete |

## Snapshot — current `main` state

### Services (all 4 live in kubeadm `cloudnative-dev-telco`)

| Service | Image | Endpoint | Sprint-1 deliverables |
|---|---|---|---|
| `ntn-metrics-emulator` | `orbitops/ntn-metrics-emulator:0.1.1-dev-g6g7g8` | NodePort `:30080` | 9 `orbitops_*` Prometheus gauges; `/scenario/{load,tick,current}` API |
| `copilot-api` | `orbitops/copilot-api:0.1.1-dev-g6g7g8` | NodePort `:30081` | `/ask` `/explain` `/runbook` `/healthz` + `/metrics` (G6 RED metrics); `FakeLLMProvider` ships v2 schema (`summary`/`likely_cause`/3–4 `recommended_actions`/`risk_if_ignored`/`confidence`/`unknowns`); 4-class anomaly classifier (snr_drop > handover_failure > gateway_outage > **doppler_compensation_warning**) |
| `digital-twin-ui` | `orbitops/digital-twin-ui:0.1.0-dev` | NodePort `:30073` | Material-UI 6 + react-router 6; pages: Overview / Beams / Anomalies / Gateways / Scenarios (with **Ready-for-Copilot** one-click affordance, PR #42) / Copilot |
| `prometheus` | `prom/prometheus:v3.5.0` | NodePort `:30090` | scrape both services (5 s) |
| `grafana` | `grafana/grafana:11.4.0` | NodePort `:30030` | OrbitOps Overview dashboard, **8 panels** (incl. Beam elevation panel id=8 from G7) |

### Backend metrics contract

9 canonical gauges in `docs/contracts/metrics.md` §3:

```
orbitops_beam_snr_db          orbitops_beam_sinr_db
orbitops_link_latency_ms      orbitops_packet_loss_ratio
orbitops_doppler_residual_hz  orbitops_handover_state
orbitops_gateway_available    orbitops_anomaly_active
orbitops_beam_elevation_deg                          ← G7 (PR #34)
```

Source-of-truth = `tests/contracts/metrics.schema.json`. `scripts/check-observability.sh` enforces dashboard parity (CI tripwire).

### Tests + gates (all green on 2026-05-02 main)

| Layer | Result |
|---|---|
| `pytest services/ tests/` | **83 passed + 1 xfail-strict** (voice-interface S2-07) |
| `vitest` (UI) | **26 passed** across 5 test files |
| `./verify.sh` | **5/5 gates green** (no-secrets / observability / schemas / scenario mirror / k8s manifests) |
| GitHub Actions CI | **6/6 SUCCESS** (verify / ruff / anonymity / schema / k8s manifest / docker compose build) |
| Live demo path E2E (PR #38 audit, repeated 2026-05-02) | UI HTML + JS bundle 200; CORS preflight passes; `/scenario/load` + `/tick(90)` + `/ask` returns `status=ok`, confidence 0.78, 3 recommended_actions citing `orbitops_beam_snr_db{beam_id="beam-1"}=6.5 dB` |

## Sprint 1 — what shipped (chronological)

| Phase / VS | PR | What |
|---|---|---|
| Sprint-0 → Sprint-1 transition | #1–#33 | Services scaffolded; ADR-007 v1→v2 schema migration; live cluster bootstrap |
| **G6** | #34 | `copilot-api` exposes `GET /metrics` via `prometheus-fastapi-instrumentator` 7.x |
| **G7** | #34 | `orbitops_beam_elevation_deg` gauge; sin-shaped over `scenario.duration_seconds`; peak from optional `scenario.satellite.pass_peak_elevation_deg` (default 55°); clamped `[0, 90]` (ADR-related defense-in-depth in PR #34) |
| **G8** | #34 | Copilot classifies `\|orbitops_doppler_residual_hz\| > 2 kHz` as `doppler_compensation_warning` (priority 4 — below snr_drop, handover_failure, gateway_outage); 3 recommended actions citing 3GPP TS 38.821 + TR 38.811 |
| Image-tag bump | #35 | `0.1.0-dev` → `0.1.1-dev-g6g7g8` for emulator + copilot in k8s manifests + docker-compose; bootstrap scripts + demo doc aligned |
| SPEC-002 + SPEC-005 elevation coverage | #36 | doc gap caught when verifying G7 completeness |
| PR #36 bot review fixes | #37 | canonical metric names + behavioral-only spec language |
| Demo path E2E audit (Phase A) | #38 | walked the actual browser-equivalent path; found and fixed Grafana ConfigMap drift live-cluster; logged VS-7 + VS-8 in backlog |
| Claims audit drift fix (Phase B.3) | #39 | 8 drift items in `docs/06–08` realigned to current code state; audit doc re-pass appended |
| `make k8s-reload-observability` (Phase C / VS-7) | #40 | new Makefile target prevents the kind of drift PR #38 found; `make help` regex bonus fix exposed 7 previously-hidden `k8s-*` targets |
| 4-step demo execution checklist (Phase D / VS-8 minimal) | #41 | append-only on `docs/08`; bot review caught 6 factual errors (CORS root cause, compose UI port drift, NodePort host ambiguity, etc.) — all fixed in same PR |
| UI Ready-for-Copilot button (Phase F / VS-8 full) | #42 | one-click `loadScenario(beam-degradation)` + `tickScenario(90)` on Scenarios page; severity=warning when `active_anomalies=[]`; split try/catch handles partial-state failure correctly |
| Copilot custom-instructions + Helm appVersion align (Phase G) | #43 | `.github/instructions/orbitops.instructions.md` codifies repo conventions for future bot reviews; Helm chart version + values tags aligned to k8s manifests |

## What's next — RunSpace submission gate

| Item | Owner | State |
|---|---|---|
| **Pitch deck PDF render** (from `docs/06_runspace_pitch_outline.md`) | user | pending |
| **Demo video recording** (90 s + 3 min per `docs/07_*.md` + `docs/08_*.md`) | user | pending; on-camera 4-step checklist documented in PR #41 |
| **UI completeness sweep — Phase H.1** | architect/implementer | scoped 2026-05-02 (`docs/reviews/2026-05-02-project-inventory.md`); ~4–6 h |
| `make archive` → metadata scrub via `exiftool -all=` | release-engineer | toolchain ready; not yet packaged for submission |
| ESLint config + UI tests in CI | implementer | scoped Tier 3 |
| Promote SPECs Draft → Accepted | architect | scoped Tier 3 |

## What's next — Sprint 2 (post-submission)

See `docs/agile/sprint-02-plan.md` — VS-7 Helm full chart, VS-8 real LLM provider (Ollama Qwen), VS-9 Recharts time-series + anomaly-inject button, VS-10 Loki mock logs, VS-11 ArgoCD App, VS-12 voice-interface (closes the test_voice_red xfail).

## Health gates

- `make verify` covers: 5 categories (no-secrets / observability / schemas / scenario mirror / k8s manifests).
- `make k8s-reload-observability` (PR #40) — re-applies the kustomize overlay + restarts Grafana/Prometheus; run after any `observability/**` change.
- `./test.sh` runs pytest + vitest (Sprint-1 actual tests, not Sprint-0 placeholders).
- CI runs 6 jobs on every push.

## Known open questions / risks

(See `docs/00_research_2026_04.md` §7 + `docs/agile/risk-register.md`.)

1. AODT public GitHub repo URL post-2026-03 announcement (research re-confirm at install time).
2. AODT minimum GPU class.
3. Sionna RT version after v2.0.1.
4. Bot-review service reliability (3 PRs hit `Copilot encountered an error` mid-Sprint-1).
5. Helm chart only ships 2 service templates (copilot + emulator); UI / Grafana / Prom templates pending in Sprint 2 VS-7.

## Risk highlights

- **R-01** LLM hallucination — mitigated by evidence schema (ADR-004); FakeLLMProvider only consumes typed `Evidence`; out-of-domain input → REFUSED; empty evidence → INSUFFICIENT_EVIDENCE.
- **R-03** Anonymity leak — `scripts/check-no-secrets.sh` (real-secret scan only since 2026-05-01 policy relaxation) + CI gate; submission-archive scrub remains a process step.
- **R-09** 7–14 day budget — Sprint 1 P0 fits the bound; pitch/video are the remaining work outside coding scope.
