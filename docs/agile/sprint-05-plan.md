# Sprint 5 — plan

| Field | Value |
|---|---|
| Sprint | 5 |
| Kickoff | 2026-07-02 |
| Theme | **Closed-loop GitOps — dry_run core** (main functionality first; security-hardening deferred) |
| Predecessor | Sprint-4 (VS-19/20/21 design) — PR #94 open, **not merged** (parked green by owner) |
| Working rule | Core/main functionality first; **defer any security feature that slows dev** (owner directive 2026-07-02). Parallelize non-conflicting slices. |

## Sprint goal

> **「操作員載入異常 → copilot 建議一個 *safe action* → 使用者按 Preview → 看到這個 action 會對 K8s manifest 造成的精確 diff(dry-run,完全不 apply、不碰 git、不碰 cluster)」**

This delivers the *observable* half of the closed-loop vision (SPEC-S006-VS21 §2)
without any of the apply/security machinery. It is demoable end-to-end and has
zero cluster-mutation risk.

## In scope (VS-21 dry_run MVP)

Implements a **subset** of SPEC-S006-VS21 §B impl ACs:

| Slice | Layer | AC | Est |
|---|---|---|---|
| **VS-22** | copilot-api: safe-action registry (3 actions from SPEC §5.1) + `POST /action/dry-run` returning a manifest diff; whitelist-only `action_id` (422). No git/apply/auth. | AC-S006-VS21.B1 (ActionPlan shape), **B6** (whitelist→422) | 1.5d |
| **VS-23** | copilot-api: `/runbook` emits an `action_plan` (which safe action fits the anomaly) so the UI can offer its dry-run — grounded (evidence-linked). | AC-S006-VS21.B1 | 1d |
| **VS-24** | digital-twin-ui: Copilot panel renders the recommended action + **"Preview change (dry-run)"** button → calls `/action/dry-run` → shows the diff. **Preview only — no Apply button yet.** | AC-S006-VS21.B2 (dry-run variant) | 1d |

Contract: new `tests/contracts/action-dry-run.schema.json` is the source of truth;
backend + UI both assert against it (enables VS-22 backend and VS-24 UI to be
built in parallel once the schema is fixed).

## Explicitly DEFERRED (security/apply machinery — record now, build later)

Per owner directive "會拖慢開發進度的資安功能都先暫緩". These are the SPEC-S006-VS21
§B ACs that require the real apply/security surface — **not** in Sprint-5:

- **B3** audit log to Loki (`closed_loop_audit`)
- **B4** rate-limit (1 per 5 min per scenario_id → 429)
- **B5** git commit to `closed-loop/auto/<ts>-<sub>` branch + GitHub App token
- **B7** `/action/{id}/observe` MetricRipple (needs a real apply to observe)
- **B8** Undo round-trip (needs apply)
- **B9** kind smoke exercising real applies
- Real apply mechanism, Kargo, in-cluster write RBAC, **JWT-gate on `/action/*`**
- **D1/D3** browser-OIDC e2e completion + flip `JWT_REQUIRED=true` (Sprint-4 review; risk-register R-15)

Tracking: these stay in SPEC-S006-VS21 §B / risk-register R-15 and [[dev_priority_core_over_security]]. The dry-run endpoint is deliberately **unauthenticated + read-only + no side effects**, so deferring auth on it is safe.

## Parallelization

1. **Serial first:** fix the `action-dry-run` contract schema + the safe-action
   registry data (action_id / target / inverse) — shared source of truth.
2. **Then parallel (file-disjoint):** VS-22 backend (services/copilot-api, Python)
   ∥ VS-24 UI (services/digital-twin-ui, TS). VS-23 folds into VS-22 (same service).

## Definition of done (each slice)

- red→green→refactor commits (CI tdd-discipline gate); `./verify.sh` green.
- dry-run endpoint has: whitelist-reject test (B6), diff-correctness test, grounding/contract test.
- **No cluster mutation, no git writes, no apply** anywhere in the code path (grep-verified).
- 7+1 anti-pattern self-audit in PR body. Chain #6: all 3 safe actions ship together.

## Non-goals (Sprint-5)

- No real apply / git / Kargo / observe / undo (deferred above).
- No auth on the dry-run endpoint (it is side-effect-free; auth deferred with D1/D3).
- No new LLM provider (owner deploys LLM separately later).
