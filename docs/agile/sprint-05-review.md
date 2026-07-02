# Sprint Review — Sprint 5

| 欄位 | 值 |
|---|---|
| Sprint | 5 |
| Dates | 2026-07-02 (single-session sprint, stacked on Sprint-4) |
| Facilitator | architect (self-review; single-contributor sprint) |
| Theme | Closed-loop GitOps — **dry_run core** (main functionality first; security/apply deferred by owner directive) |
| Demo surface | `feat/vs-22-closed-loop-dry-run` branch (pushed to origin as backup; **no PR, not merged**) |

## Sprint goal restatement

> **「操作員載入異常 → copilot 建議一個 safe action → 使用者 Preview → 看到該 action 對 K8s manifest 的精確 diff(dry-run,完全不 apply / 不碰 git / 不碰 cluster)」**

**狀態**：✅ ACHIEVED end-to-end. The closed-loop's *observable* half ships with zero cluster-mutation risk.

## Sprint outcome

| Vertical Slice | Status | AC | Notes |
|---|---|---|---|
| **VS-22** safe-action registry + `/action/dry-run` | ✅ done | AC-S006-VS21.B6 (whitelist→422), B1 (patch shape) | 3 SPEC §5.1 actions; pure patch builders; side-effect-free endpoint |
| **VS-22b** `GET /action/catalog` | ✅ done | (enabler) | single source of truth so the UI never hardcodes the action set (Chain #1) |
| **VS-23** grounded `action_plan` on `/ask` + `/runbook` | ✅ done | AC-S006-VS21.B1 | anomaly→action mapping; only on grounded responses (ADR-004) |
| **VS-24** UI closed-loop preview panel | ✅ done | AC-S006-VS21.B2 (dry-run variant) | catalog-driven form + diff render; **no Apply button** (asserted) |

**Commit chain**: docs plan (e90ace1) → red (47d97e1) → green VS-22 (7a2a063) → catalog (085b55d) → green VS-24 UI (49108e2) → green VS-23 (198548a).

## What we shipped

### VS-22 — safe-action registry + dry-run (copilot-api)
- `_actions.py`: 3 whitelisted actions (`scale_copilot_api_replicas`, `restart_emulator_pod`, `set_payload_mode`) — each a strategic-merge patch builder + param validation + inverse + params_spec. Pure functions; mutate nothing.
- `POST /action/dry-run`: whitelist-validated (unknown→422 `unknown_action`; bad params→422 `invalid_params` via exception handlers mirroring `_JWTError`); returns `{target_resource, patch, diff, inverse_action_id, dry_run:true, note}`.
- `GET /action/catalog`: read-only list driving the UI form.
- Both endpoints are **unauthenticated by design** — side-effect-free, no git/apply/cluster; auth deferred with the apply surface.

### VS-23 — grounded action recommendation
- `recommend_action(anomaly_type)`: `snr_drop`→`set_payload_mode(regenerative)`, `handover_failure`→`restart_emulator_pod`, `gateway_outage`→`scale_copilot_api_replicas(2)`; `doppler_compensation_warning`/unknown→`None` (never suggest an action that wouldn't help).
- `CopilotResponse.action_plan` attached on grounded `/ask` + `/runbook` only — never on INSUFFICIENT/REFUSED (ADR-004: no action without evidence). `copilot-response.schema.json` extended (schema is the contract).

### VS-24 — UI preview panel (digital-twin-ui)
- `ClosedLoopPanel`: fetches the catalog, renders per-action param inputs + "Preview change (dry-run)" → `/action/dry-run` → shows the manifest diff + "no mutation" note. Data-driven (no hardcoded actions/bounds).
- Copilot response surfaces the grounded recommendation + a hint to the panel.
- i18n `closedLoop.*` in en + zh-TW. **Preview-only — no Apply button** (test-asserted).

## What we did NOT ship (deferred — recorded, not dropped)

Per owner directive "會拖慢開發進度的資安功能都先暫緩":
- Real apply / git commit (`closed-loop/auto/*` branch) / GitHub App token (B5)
- Kargo promotion + human-approval gate; in-cluster write RBAC
- `/action/{id}/observe` MetricRipple (B7); Undo round-trip (B8); kind smoke with real apply (B9)
- Rate-limit (B4) + audit-log to Loki (B3); **JWT-gate on `/action/*`**
- **D1/D3** browser-OIDC e2e + flip `JWT_REQUIRED=true` (Sprint-4 review; risk-register R-15)

Tracking: SPEC-S006-VS21 §B, risk-register R-15, `docs/agile/sprint-05-plan.md`, memory `dev_priority_core_over_security`.

## Quality gates

- `./verify.sh` — all 5 gates + advisory gates green ✅
- copilot-api: **95 pytest** (+22 this sprint: dry-run 12, action_plan 5, +5 registry) ✅
- digital-twin-ui: **163 vitest** (+11: ClosedLoopPanel 5, Copilot VS-23 1, others) ✅; `tsc --noEmit` clean; `vite build` OK
- ruff clean; contract schema validates
- 7+1 anti-pattern self-audit:
  - #1 grep-verify — ✅ every recommended action_id is in `SAFE_ACTION_IDS`; UI action list comes from the catalog (no hardcode)
  - #2 POST-WRITE — ✅ ran pytest/vitest/tsc after each change; caught the schema-contract break before commit
  - #3 cross-page — ✅ en/zh-TW parity for `closedLoop.*`; schema ↔ models ↔ UI types aligned
  - #4 NaN guard — N/A
  - #5 first-call-only — ✅ catalog fetched once on mount (AbortController cleanup)
  - #6 partial-migration — ✅ all 3 actions ship together (registry + catalog + recommend map)
  - #7 Resium — N/A
  - #X process — ✅ red(47d97e1) precedes green; dry-run/whitelist/side-effect-free all test-first

## Metrics

- Test counts: 95 pytest + 1 xfail; 163 vitest; total +33 tests this sprint
- New anti-patterns surfaced: none new; **2 recurring hazards logged** (below)

## Retrospective

| Continue | Stop | Start |
|---|---|---|
| Catalog-as-single-source-of-truth to kill UI/backend drift (Chain #1) | Adding an import line *before* the code that uses it — ruff auto-fix stripped 3 imports (models `Any`, main `_actions`/models) mid-edit | Add the *usage* first, then the import (ruff keeps used imports); or run `ruff check` before pytest |
| Schema-as-contract caught the `action_plan` additivity break at verify time | Trusting that a new model field is "just additive" | When adding a `CopilotResponse` field, update `copilot-response.schema.json` in the same edit |
| Side-effect-free-by-design (no auth needed because no side effects) | — | Keep the apply endpoint (Sprint-6) behind JWT from day one — that IS a side effect |

## Risks diff

| ID | Change | Score |
|---|---|---|
| R-15 (auth deployed OFF) | unchanged — dry-run endpoints are side-effect-free so auth-deferral is safe for them; still open for the eventual apply path | L3×I3=9, open |
| **NEW R-17** | Closed-loop *apply* not yet built — the UI shows "preview only"; a future contributor could wire apply without the mandatory human-approval + audit + rate-limit (SPEC-S006-VS21 §5.3). Mitigation: apply surface stays unimplemented; SPEC §B ACs (B3/B4/B5/B8) gate it; no `/action/*apply*` route exists. | L2×I4=8, open |

## Action items for Sprint-6

- [ ] Merge decisions: Sprint-4 PR #94 + this Sprint-5 branch (owner-gated; both green, unmerged)
- [ ] VS-25 (if approved): closed-loop **apply** — git commit path + human-approval gate + audit + rate-limit + JWT (B3/B4/B5), behind ADR-013
- [ ] Revisit deferred security: D1/D3 browser-OIDC + `JWT_REQUIRED=true` (R-15)
- [ ] Update memory sprint state to reflect Sprint-5 completion
