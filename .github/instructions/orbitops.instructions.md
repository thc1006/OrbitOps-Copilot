---
applyTo: "**"
---

# OrbitOps Copilot — repo-level review instructions

> Read this before reviewing any PR. These conventions are enforced project-wide and override generic best-practice suggestions.

This is **OrbitOps Copilot**, a B5G/NTN low-orbit ground-station cloud-native operations digital twin + LLM Copilot sandbox. Source-of-truth for project conventions is `CLAUDE.md`. The points below are the high-leverage items that a code review should catch.

## 1. Metric naming (post-ADR-007 v2 schema)

The 9 canonical `orbitops_*` metrics are listed in `docs/contracts/metrics.md` §3:

```
orbitops_beam_snr_db          orbitops_beam_sinr_db
orbitops_link_latency_ms      orbitops_packet_loss_ratio
orbitops_doppler_residual_hz  orbitops_handover_state
orbitops_gateway_available    orbitops_anomaly_active
orbitops_beam_elevation_deg
```

**v1 names that must NEVER appear** (removed in `metrics.md §7` migration table):

- `orbitops_snr_db` → use `orbitops_beam_snr_db`
- `orbitops_sinr_db` → use `orbitops_beam_sinr_db`
- `orbitops_latency_ms` → use `orbitops_link_latency_ms`
- `orbitops_pod_health` → REMOVED; for gateway-fallback use `orbitops_gateway_available`
- `orbitops_handover_failures_total` → REMOVED; covered by `orbitops_handover_state` + `orbitops_anomaly_active{type=...}`
- `orbitops_elevation_deg` → use `orbitops_beam_elevation_deg` (per-beam labelling)

If you see a v1 name in any PR diff (code, docs, tests, scenarios), flag it as a drift bug.

## 2. Evidence-grounded LLM (ADR-004)

`copilot-api` responses MUST follow the `CopilotResponse` schema in `tests/contracts/copilot-response.schema.json`:

- `evidence` block has exactly 5 fields: `metrics_used`, `logs_used`, `scenario_id`, `time_window_seconds`, `timestamp`. **`confidence` and `unknowns` are top-level CopilotResponse fields, NOT inside evidence.**
- Any `status: "ok"` response must cite ≥ 1 piece of evidence. Empty evidence → `INSUFFICIENT_EVIDENCE`. Out-of-domain question → `REFUSED`.
- Provider must NEVER fabricate. If you see a code path that emits `summary` / `likely_cause` without first inspecting `evidence.metrics_used`, flag it.

Anomaly classification priority (mutually exclusive; first match wins; per `_retrieval.classify()` and `docs/contracts/metrics.md §8`):

1. `orbitops_beam_snr_db < 8.0` → `snr_drop`
2. `orbitops_handover_state ≥ 2` → `handover_failure`
3. `orbitops_gateway_available < 0.5` → `gateway_outage`
4. `|orbitops_doppler_residual_hz| > 2000.0` → `doppler_compensation_warning` (G8; ~⅔ of the 10%-SCS=30 kHz operational ceiling per 3GPP TS 38.821 + TR 38.811)

## 3. TDD discipline (CLAUDE.md §12.2)

**Failing tests must precede the implementation in git history.** A PR that adds a new feature without a prior red commit (or at least a red→green pair within the PR) violates the discipline. The three steps may be combined into fewer commits, but the failing test must exist somewhere in history.

Pytest patterns:

- `pytest.mark.xfail(strict=True, reason="...")` is the formal defer for not-yet-implemented tests. `strict=True` flags any accidental pass.
- `it.todo(...)` / `test.todo(...)` for vitest equivalents.
- Tests must NOT silently pass when the feature isn't done.

## 4. Python services (Pydantic v2 / FastAPI / pytest)

- `from __future__ import annotations` at top of every file
- Public functions have type hints
- HTTP error responses use `c.JSON(status, gin.H{...})`-style structure: `{"status":"fail","error": msg}` — never raw `err.Error()` text
- `logging.getLogger(__name__)` — never `print()`
- Tests are colocated with the module (`foo.py` next to `foo_test.py`)
- Table-driven test pattern preferred

## 5. TypeScript / React UI (digital-twin-ui)

- React 19 + MUI 6 + react-router 6
- **No `any`** — use `unknown` + type guards or define real interfaces. Errors typed as `ApiError`
- All `console.error` must funnel through `src/utils/logger.ts`
- Functional components + hooks only (exception: `ErrorBoundary` is a class)
- `import { type Foo } from '...'` (explicit `type` for type-only imports)
- API calls use `fetch` wrapped in `src/api.ts`; component bodies don't reach for `globalThis.fetch` directly

## 6. K8s deploy + observability

- `imagePullPolicy: IfNotPresent` is intentional — images come from local containerd via `ctr -n=k8s.io images import` (kubeadm) or `kind load docker-image` (kind). No real registry.
- After any change to `observability/grafana/dashboards/*.json` or `observability/prometheus/prometheus.yml`, run `make k8s-reload-observability` (VS-7) — Grafana provisioning's `updateIntervalSeconds=30` only re-reads when the ConfigMap *changes*, and that requires `kubectl apply`.
- New metrics MUST also land in `scripts/check-observability.sh` REQUIRED list (CI tripwire) AND in a Grafana dashboard panel.
- Pin all image tags. `:latest` is forbidden.

## 7. Anonymity / submission packaging (CLAUDE.md §2.1, §7)

The repo is NO LONGER anonymous-by-default (policy relaxed 2026-05-01). Real names, school, and GitHub identity are allowed in source / commits / docs. The submission ARCHIVE (RunSpace zip / pitch deck / video) is the only layer where per-cycle anonymity rules may apply.

`scripts/check-no-secrets.sh` only blocks REAL secrets (AKID / OpenAI / Anthropic / GitHub tokens / PEM headers) — it no longer flags school / real-name / Gmail patterns.

## 8. Forbidden over-claims

This is a sandbox. The following are NOT delivered today and any PR that claims otherwise should be flagged:

- Real Ka-band beam steering, real SDR OTA, real antenna control
- Full OAI / srsRAN NTN stack integration
- Full O-RAN O2 IMS lifecycle (only stub package ships)
- Real Sionna RT channel coefficients (P2)
- Real AODT integration (P2/P3, post-OSS-release)
- Free-form LLM hallucinations (ADR-004 forbids)

P0 ships: scenario emulator + evidence-grounded LLM + observability + UI shell + 3 sample scenarios. The roadmap is honest about boundaries.

## 9. Useful PR-review heuristics for THIS repo

- If a PR touches `_retrieval.py` thresholds, also check `docs/contracts/metrics.md §8` and `docs/specs/SPEC-003-copilot-api.md §8.1` are aligned.
- If a PR touches `_compute.py` metric values, check `docs/contracts/metrics.md §3` ranges still hold.
- If a PR touches `scenario.schema.json`, check fixtures in `packages/scenarios/*.json` still validate.
- If a PR adds a new metric, check ALL of: contract doc + dashboard panel + check-observability.sh + SPEC-002/§7 + SPEC-005.
- If a PR is doc-only on `docs/06–08`, audit whether claims still match current code (use `docs/reviews/runspace-claims-audit.md` as template).
