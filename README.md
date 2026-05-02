# OrbitOps Copilot

> **A cloud-native operations digital twin for B5G LEO ground stations.**
> 軌道運維副駕：B5G 低軌地面站的雲原生運維數位孿生與 AI 決策支援。

## What it is

OrbitOps Copilot is a Kubernetes-deployable sandbox combining a NTN scenario generator, a metrics emulator, observability (Prometheus + Grafana), a digital-twin web UI, and an **evidence-grounded LLM copilot** that explains beam-quality, handover, and gateway-fallback anomalies — and emits 5-step runbooks. Standards-aligned to **3GPP Release 19 NTN** (frozen Dec 2025) and packaged in a **Nephio R5** GitOps idiom.

## Why now

- TASA B5G LEO program: 1A (CesiumAstro Vireo Ka, ~2027), 1B (YTTEK SDR baseband, ~2030). Ground-station operations toolchain remains public whitespace.
- 3GPP Rel-19 frozen 2025-12; regenerative payload + ISL handover + Store-and-Forward + RedCap-NTN.
- AI-RAN Alliance MWC 2026: 132 members, "Platform & Infrastructure Orchestration" blueprint.
- NVIDIA Aerial open-sourced under Apache-2.0 (Oct 2025); AODT public on GitHub (Mar 2026).

See `docs/00_research_2026_04.md` for full sources.

## Status — **Sprint 1 P0 substantively complete** (as of 2026-05-02)

| Layer | State |
|---|---|
| 4 services | `scenario-generator`, `ntn-metrics-emulator`, `copilot-api`, `digital-twin-ui` — all running |
| Backend metrics | 9 `orbitops_*` Prometheus gauges (per `docs/contracts/metrics.md`); copilot-api also exposes `/metrics` (G6 RED metrics) |
| Copilot anomaly classifications | 4 types (snr_drop, handover_failure, gateway_outage, doppler_compensation_warning); `FakeLLMProvider` returns evidence-grounded `summary` + `likely_cause` + 3–4 `recommended_actions` + `risk_if_ignored` per ADR-007 v2 schema |
| Live cluster | kubeadm `cloudnative-dev-telco`; 5 pods Running; Prometheus scrapes both services; Grafana 8-panel dashboard (incl. beam elevation, panel id=8) |
| TDD | 84 pytest (83 passed + 1 xfail-strict for voice S2-07); 26 vitest |
| Submission gates | `verify.sh` 5/5 + CI 6 jobs |

**What's still pending for the RunSpace submission**: pitch-deck PDF render, demo video recording (90 s + 3 min), and a **UI completeness sweep** (Phase H — see `docs/reviews/runspace-claims-audit.md` "Deferred nits" + the Sprint-2 backlog) covering Beams elevation column / Anomalies dictionary expansion / 3-scenario UI loadability / Copilot full-evidence display.

**Sprint 2 brings**: real LLM provider (Ollama / vLLM via OpenAI-compatible adapter), Loki mock-logs integration, Recharts time-series, ArgoCD App reference. See `PROJECT_STATUS.md` for the live-state snapshot.

## Quickstart

```bash
# 0. Verify environment + remote tool versions (re-run before each sprint)
./verify.sh

# 1. Bootstrap tooling (Python venv + Node deps)
make bootstrap

# 2. Local dev with docker-compose (all services + Prometheus + Grafana)
make dev-up
# → UI:        http://localhost:5173
# → Copilot:   http://localhost:8001/healthz
# → Emulator:  http://localhost:8000/metrics
# → Prom:      http://localhost:9090
# → Grafana:   http://localhost:3000  (admin/admin, change on first run)

# 3. Run end-to-end golden demo (beam-degradation + handover + fallback)
scripts/run-demo.sh

# 4. Tear down
make dev-down

# 5. Kubernetes (kind) — Sprint 1 onwards
make kind-up
make k8s-apply
make k8s-smoke
```

## Layout

```
orbitops-copilot/
├── CLAUDE.md                       # Engineering constitution (SDD/TDD/Agile + scope)
├── AGENTS.md                       # Subagent roster (7 roles)
├── docs/                           # Research, specs, ADRs, agile artifacts
│   ├── 00_research_2026_04.md      # Phase 1 research with sources
│   ├── 01_product_strategy.md      # Product strategy + UC1/UC2
│   ├── 02_architecture.md          # Mermaid arch + sequences + boundaries
│   ├── 03_breakthrough_directions.md
│   ├── 04_technical_decisions.md   # ADR index
│   ├── 05_validation_plan.md       # Test plan + anonymity checklist
│   ├── 06_runspace_pitch_outline.md
│   ├── 07_demo_script_90s.md
│   ├── 08_demo_script_3min.md
│   ├── 09_installation_research.md # Verified versions + verify cmds
│   ├── 10_links.md                 # External-source allowlist
│   ├── specs/                      # SDD: SPEC-000~007
│   ├── acceptance/                 # AC-001~004
│   ├── adr/                        # ADR-001~005
│   └── agile/                      # backlog, sprint-NN-plan, DoD, risk-register, review template
├── services/
│   ├── scenario-generator/         # Python — produces scenario JSON
│   ├── ntn-metrics-emulator/       # FastAPI — exposes /metrics
│   ├── copilot-api/                # FastAPI — /ask /explain /runbook
│   ├── digital-twin-ui/            # React + Vite + TS + Tailwind
│   └── voice-interface/            # Optional ASR (faster-whisper) stub
├── deploy/
│   ├── k8s/{base,overlays/local}   # Kustomize
│   ├── helm/orbitops-copilot/      # Helm chart skeleton
│   ├── docker-compose.yml          # Dev fast-path
│   ├── kind/cluster.yaml
│   └── k3d/cluster.yaml
├── observability/
│   ├── prometheus/prometheus.yml
│   └── grafana/{dashboards,provisioning}
├── packages/
│   ├── scenarios/                  # 3 sample scenarios (beam, handover, gateway)
│   └── nephio-stubs/               # kpt package skeleton (R5 idiom)
├── tests/
│   ├── contracts/                  # JSON schemas (scenario, metrics, copilot-response)
│   ├── golden/                     # expected outputs for golden replay
│   ├── unit/                       # cross-service unit tests
│   ├── integration/                # API + docker-compose
│   └── k8s-smoke/                  # k8s deployment smoke
├── scripts/                        # bootstrap / dev-up / run-demo / check-no-secrets / ...
├── .claude/                        # Claude Code config (settings, commands, agents, skills)
├── .github/workflows/ci.yml        # CI gates
├── Makefile
├── verify.sh
└── test.sh
```

## Engineering rules in one breath

- **SDD**: every feature → `docs/specs/SPEC-NNN-*.md` + `docs/acceptance/AC-NNN-*.md` first.
- **TDD**: failing test first (red commit) → implementation (green commit) → refactor.
- **Agile**: 1–2 day vertical slices, listed in `docs/agile/backlog.md`.
- **Anonymous**: no team / school / personal identifiers anywhere — `scripts/check-no-secrets.sh` enforces.
- **Evidence-grounded LLM**: every copilot answer must cite metrics/logs; `INSUFFICIENT_EVIDENCE` when none.

Full constitution in `CLAUDE.md`.

## License

See `LICENSE`. Project license is **Apache-2.0**. Several **dependencies** are AGPL (Grafana 13, Loki 3, Tempo, Open5GS, srsRAN), MIT (Ollama, llama.cpp), or model-specific (Llama 4 Community, Kimi Modified MIT). Verify per-component license at distribution time. See `docs/09_installation_research.md`.

## Contributing

See `CONTRIBUTING.md`. Briefly: fork → branch `feat/SPEC-NNN-slug` → write failing test first → make it green → `make verify` → PR with `[SPEC-NNN]` title.

## Acknowledgements (anonymized)

Public-information acknowledgements only — TASA, CesiumAstro, YTTEK, 3GPP, O-RAN Alliance, Nephio, NVIDIA, AI-RAN Alliance. No team / school / personal acknowledgements per RunSpace anonymity rules.
