# PROJECT STATUS

| Field | Value |
|---|---|
| Date | 2026-04-30 |
| Sprint | 0 (closed) → 1 (planned) |
| Tier | Sprint 0 skeleton complete |

## What's done

- [x] Repo skeleton + directory tree
- [x] Engineering constitution (`CLAUDE.md`, `AGENTS.md`)
- [x] Phase 1 research (`docs/00_research_2026_04.md`)
- [x] Phase 2 design (`docs/01_product_strategy.md` ~ `docs/05_validation_plan.md`)
- [x] Pitch artifacts (`docs/06_runspace_pitch_outline.md`, `docs/07_demo_script_90s.md`, `docs/08_demo_script_3min.md`)
- [x] Installation research with verified versions (`docs/09_installation_research.md`)
- [x] Source allowlist (`docs/10_links.md`)
- [x] SDD: SPEC-000 ~ SPEC-007 (8 specs)
- [x] Acceptance: AC-001 ~ AC-004 (4 ACs)
- [x] ADR: ADR-001 ~ ADR-005 (5 ADRs)
- [x] Agile: backlog, 4 sprint plans, DoD, risk register, review template
- [x] Test contracts: `scenario.schema.json`, `metrics.schema.json`, `copilot-response.schema.json`
- [x] Golden expected: 3 expected JSONs (beam, handover, gateway)
- [x] Tooling: Makefile, verify.sh, test.sh, scripts/
- [x] CI: `.github/workflows/ci.yml`
- [x] Claude Code config: `.claude/settings.json`, 6 commands, 7 agents, 3 skills
- [x] Service skeletons (placeholder; not implemented)
- [x] Deploy skeletons (Kustomize base, Helm skeleton, kind/k3d, docker-compose)
- [x] Observability skeletons (Prometheus config, Grafana dashboard placeholder)
- [x] Sample scenarios (3 JSON files passing schema)
- [x] Nephio stub package skeleton

## What's next — Sprint 1 (P0 core vertical slice)

See `docs/agile/sprint-01-plan.md`.

## Health gates

- `make verify` — green at this point covers: lint placeholders, JSON schema validation, no-secrets check, k8s manifest validation. Not yet covers actual unit tests (services unimplemented).
- `./test.sh` — gracefully reports which tests do not yet exist (does not fake green).

## Known open questions

(See `docs/00_research_2026_04.md` §7 for full list and verify commands.)

1. AODT public GitHub repo URL post-2026-03 announcement.
2. AODT minimum GPU class.
3. 3GPP Rel-19 NTN regenerative TS document numbers.
4. Vireo Ka exact beam count.
5. Sionna RT version after v2.0.1.

## Risk highlights

(See `docs/agile/risk-register.md` for full list.)

- **R-01** LLM hallucination — mitigated by evidence schema; live only on Sprint 1+.
- **R-03** Anonymity leak — `scripts/check-no-secrets.sh` + CI gate.
- **R-09** 7-14 day budget — strict P0 scope; vertical slices.
