# RunSpace Claims Audit — OrbitOps Copilot

| Field | Value |
|---|---|
| Auditor | claims-audit skill (manual pass) |
| Branch under review | `chore/repo-review` |
| Date | 2026-04-30 |
| Scope | Every assertion in `README.md`, `docs/01_product_strategy.md`, `docs/06`, `docs/07`, `docs/08`, `docs/03`, `docs/demo/*.md` |

Per `claims-audit` skill: every claim must classify as one of:

- **implemented** — runs in this repo today; testable via `./test.sh`
- **simulated** — produced by emulator or mock; explicitly labelled "simulation"
- **planned** — on roadmap; tagged P1 / P2 / P3 with backlog ID
- **external_reference** — third-party fact with URL + date

Anything else = **OVER-CLAIM**.

## Audit result

| Source | Claims sampled | OVER-CLAIM | Notes |
|---|---|---|---|
| `README.md` | 8 | 0 | Status box explicitly says "Sprint 0 skeleton (P0 in progress)". UC1/UC2 framed as "what it is", not "what we shipped". External anchors (3GPP Rel-19 frozen Dec 2025, NVIDIA Aerial Apache 2.0 Oct 2025) are external_reference with dates. |
| `docs/01_product_strategy.md` | 12 | 0 | `## 不做的功能（reaffirm）` section explicitly removes 4 implementation candidates. MVP scope = `scenario-generator + ntn-metrics-emulator + copilot-api(mock) + ui shell + Prometheus + Grafana + 3 sample scenarios`. All scoped. |
| `docs/06_runspace_pitch_outline.md` | 9 | 0 | Future targets ("Sionna RT v2.0.1 channel realism", "real OAI/srsRAN") clearly marked P2 / P3 in `Roadmap` cell. |
| `docs/07_demo_script_90s.md` | 4 | 0 | "MVP today, AODT- and Sionna-RT-ready tomorrow." — explicitly future-tagged. |
| `docs/08_demo_script_3min.md` | 6 | 0 | "we ask: 'which beam is degrading?' the copilot answers — citing the exact metrics that prove it." — implemented + simulated (FakeLLMProvider). |
| `docs/03_breakthrough_directions.md` | 5 | 0 | All 5 directions tagged with maturity (D1 = P0 done, D5 = P2/P3 future). |
| `docs/demo/beam-quality-copilot.md` | 7 | 0 | Limitations section explicit: mock provider only, single-anomaly diagnosis, time_window descriptive only, no real Prometheus, no streaming, no authn. |
| `docs/demo/observability.md` | 5 | 0 | "Sprint 1: copilot-api does not yet emit /metrics" — explicit. |
| `docs/demo/k8s-deployment.md` | 6 | 0 | Limitations: NodePort kind-only, no Prom in K8s yet, no GPU, no cluster-admin, "Nephio integration is stub-only". |
| `packages/nephio-stubs/README.md` | 8 | 0 | Explicit IS / IS-NOT lists. Forbidden claims enumerated. |
| `docs/future/nephio-o2ims-integration.md` | 5 phases | 0 | Each phase time-boxed (weeks/sprints/quarter+). "Sprint 1 ships intent only." |

**Total: 75 claims sampled; 0 OVER-CLAIM.**

## Specific patterns observed

### Strong (keep doing)

- **Sprint-tagged** capability statements: "Sprint 1 ships X; Sprint 2 adds Y; Sprint 3 brings Z." Examples: `docs/contracts/metrics.md` §3 latency range "(Sprint 1; widens in P2)"; `docs/demo/observability.md` "Sprint 1: copilot-api does not yet emit /metrics".
- **Provenance** for external facts: every 3GPP / TASA / Nephio / NVIDIA reference cites URL + date. Example: `docs/00_research_2026_04.md` §2.5 cites "Rel-19 frozen 2025-12 Baltimore" with FirstNet/Ericsson sources.
- **IS/IS-NOT contrasts** in stubs: `packages/nephio-stubs/README.md` ships explicit "What this stub IS / IS NOT" sections + claim-policy ("OK to say / Forbidden to say") rather than leaving the boundary implicit.
- **Failure modes documented** in tests: `AC-003.2` (hallucination guard), `AC-003.3` (injection guard), `AC-001 §Failure modes`. The tests themselves prove the negative claims.

### Adequate but improvable

- The phrase "**evidence-grounded**" appears in `docs/01` and slide 4 of `docs/06`. Strictly true (the FakeLLMProvider only consumes structured `Evidence` per ADR-004), but the term has heavy connotation in LLM-grounding research literature. Suggest a tighter phrasing like "**RAG-style mock provider that only consumes typed Evidence**" in pitch-facing docs.
- "**Cloud-native**" used freely. Justified by: containerization in `Dockerfile` × 2, Kubernetes manifests for 3 services, GitOps stub. But typo-friendly mistake: docs at root say "cloud-native operations digital twin" — accurate but overlapping vocabulary with real Aerial / Sionna products. No fix needed; just monitor.

### No over-claim, no marketing fluff

The marketing-word grep (`seamless / complete / production-ready / fully-integrated / enterprise-grade / state-of-the-art`) returned 1 false positive in `ADR-006-early-install-github-mcp.md` § Alternatives ("rejected"). All other matches were absent.

## Auto-applied this PR

Add `claims-audit` integration to `verify.sh` gate 6b (advisory): grep marketing words across all `docs/**/*.md` and `README.md`; print WARN per match for manual review. Does not fail.

## Pre-RunSpace submission gate

Per Sprint 3 plan VS-18 (`docs/agile/sprint-03-plan.md`), before final ZIP:

1. Re-run `claims-audit` over the **PDF deck** (extract text via `pdftotext`).
2. Re-run over the **video script**.
3. Run `exiftool -all=` to strip metadata.
4. Verify zero `thc1006` / `蔡秀吉` / `NYCU` / `gmail.com` matches across all submission artifacts.

This is process; not auto-fixed in this branch.

---

# Re-audit pass — 2026-05-01

| Field | Value |
|---|---|
| Auditor | Claude Code (auto-mode) under user direction (Phase B of post-G6/G7/G8 verification) |
| Trigger | After PRs #34/#35/#36/#37/#38 merged (G6/G7/G8 + image-tag + spec-doc + bot-comment + demo-path-audit). User asked: "are claims still aligned with current code state?" |
| Scope | Re-scan `docs/06–08` (the original 2026-04-30 pass found 0 over-claims; this pass focuses on **drift**, not over-claim — i.e. claims that *were* accurate then but *aren't* anymore) |
| Method | Extracted every factual claim → cross-referenced (a) live code in current `main`, (b) `docs/contracts/metrics.md` §3 + §7 migration table, (c) FakeLLMProvider runtime behavior, (d) `docs/00_research_2026_04.md` for external facts |

## Internal claims — drift findings (8)

| # | Source | Claim | Reality (post-PR-#34/#130) | Verdict | Action |
|---|---|---|---|---|---|
| R1 | 06.P4 | UC1 cites `orbitops_snr_db{beam_id="beam-1"}` | v1 name; canonical is `orbitops_beam_snr_db` (per ADR-007 v1→v2 schema migration; `metrics.md §7` migration table row 1) | **DRIFTED** | Renamed to v2 in this PR |
| R2 | 06.P5 | UC2 mentions "mock pod health drop" | `orbitops_pod_health` was removed in ADR-007 v1→v2 migration (`metrics.md §7`); replaced by `orbitops_gateway_available` for gateway-fallback flow | **DRIFTED** | Reframed to `orbitops_handover_state` + `orbitops_gateway_available` |
| R3 | 06.P5 | "5-step runbook" | v2 schema (ADR-007) hoisted *what / why / risk* to top-level (`summary` / `likely_cause` / `risk_if_ignored`); `recommended_actions[]` carries 3–4 ranked actions; coverage ≥ "5 steps" but shape differs | **DRIFTED** (framing) | Reworded with v2 schema reference + ADR pointer |
| R4 | 08/0:20–0:40 | Stack lists "CesiumJS" as current | UI has zero `cesium` references in `package.json` or `src/`; CLAUDE.md §9 explicitly defers CesiumJS pass viz to P1 | **OVERCLAIM** | Moved to "P1 roadmap" callout in same line; current stack now reads "FastAPI, React + Material UI" |
| R5 | 08/0:40–1:10 | "Emulator emits SNR, SINR, latency, packet loss, Doppler residual, elevation, handover state" (7) | Actual: 9 `orbitops_*` gauges — claim missed `gateway_available` + `anomaly_active` (and elevation is the post-G7 addition) | **UNDERCOUNT** | Now lists all 9 |
| R6 | 08/1:10–1:30 | Evidence block keys = "metrics_used + recommended_actions + unknowns" | `recommended_actions` is part of *response analysis*, not the `evidence` object. v2 evidence keys: `metrics_used` / `logs_used` / `scenario_id` / `time_window_seconds` / `timestamp` / `confidence` | **CATEGORY ERROR** | Split into "evidence block" vs "structured analysis" with ADR-004 pointer |
| R7 | 08/1:30–1:50 | "gateway pod going unhealthy" | Implies `pod_health` metric (removed); current path is `orbitops_gateway_available=0` | **DRIFTED** | Reworded to "gateway availability drop" with metric name |
| R8 | 08/1:50–2:10 | "5-step runbook: what, why, action, risk, next" | Same framing drift as R3 | **DRIFTED** | Reworded with concrete example actions matching FakeLLMProvider |

## Internal claims verified clean (3)

| # | Source | Claim | Verification | Verdict |
|---|---|---|---|---|
| V1 | 06.P10 | `make dev-up && scripts/run-demo.sh` | Both targets / scripts present in repo | ✓ |
| V2 | 07/0:18–0:35 | "Anomaly injects at t=60s" on beam-degradation | `t_offset_seconds=60` confirmed in `packages/scenarios/beam-degradation.json` | ✓ |
| V3 | 07/0:35–0:55 | `orbitops_beam_snr_db=6.5 dB` + AC-001 8 dB threshold | `_retrieval.SNR_DROP_THRESHOLD_DB = 8.0`; live cluster test (`docs/reviews/demo-path-audit-2026-05-01.md`) confirms 6.5 dB at t=90 | ✓ |

## External facts — research-doc cross-check (8)

All cross-checked against `docs/00_research_2026_04.md`:

| # | Claim | Anchor | Verdict |
|---|---|---|---|
| E1 | "3GPP Rel-19 frozen 2025-12 (regenerative payload, ISL, Store-and-Forward, IoT-NTN Phase 3, RedCap-NTN)" | `00.research §2.5 lines 64–66` w/ FirstNet + 3GPP URLs | ✓ |
| E2 | "Rel-20 freeze 2026-09 (Ku-band NR-NTN, GNSS-resilience)" | `00.research lines 73–74` w/ RCRWireless + Tech Edge Wireless URLs | ✓ |
| E3 | "AI-RAN Alliance MWC 2026: 'Platform & Infrastructure Orchestration' blueprint" | `00.research §2.9 line 101` w/ Yahoo Finance + Nokia MWC26 URLs | ✓ verbatim |
| E4 | "NVIDIA Aerial open-sourced under Apache 2.0" | `00.research line 98` w/ NVIDIA blog URL | ✓ |
| E5 | "Sionna RT v2.0.1" (2026-04-01) | `00.research line 100` (NVlabs/sionna-rt releases) | ✓ |
| E6 | "AODT-ready tomorrow" / AODT 2026-03 OSS | `00.research line 98` flags this as "needs re-confirm at install time"; demo claim is *future-tagged* (`tomorrow`), not present-tense | ✓ |
| E7 | "TASA B5G LEO 1A (CesiumAstro Vireo Ka, ~2027), 1B (YTTEK SDR, ~2030)" | `00.research §2.1 lines 28–32` w/ TASA + Via Satellite + Digitimes URLs | ✓ |
| E8 | "Via Satellite 2025-04-01" citation | `00.research §2.2` cites `satellitetoday.com/government-military/2025/04/01/...` | ✓ |

External facts: **all 8 valid**, no drift.

## Summary

- **8 internal drift / overclaim items** → all fixed in this PR (`docs/06_*.md` + `docs/08_*.md`).
- **3 internal claims** verified clean.
- **8 external facts** verified against research doc, all valid.

Combined with the original 2026-04-30 audit (75 claims sampled, 0 over-claim at that time), the project's narrative artifacts now reflect the post-G6/G7/G8 code state.

## Future safeguards (deferred to backlog)

1. `make audit-claims` script that greps for v1 metric names + ADR-superseded vocabulary across `docs/**/*.md`. Add as VS-9 in backlog.
2. Whenever `docs/contracts/metrics.md` migration table grows, this audit re-runs as part of the PR.
3. Whenever ADR-007-style schema changes ship, `docs/06–08` runbook framing must be re-checked for "5-step" language or evidence-block key drift.
