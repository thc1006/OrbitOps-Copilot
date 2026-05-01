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
4. Verify zero `<OWNER>` / `<real-name-redacted>` / `<school-redacted>` / `gmail.com` matches across all submission artifacts.

This is process; not auto-fixed in this branch.
