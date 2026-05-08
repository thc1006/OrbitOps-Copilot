# AC-S006-2 — Closed-loop GitOps reconcile

| Field | Value |
|---|---|
| Parent SPEC | SPEC-S006-2 |
| Sprint | 4 design phase (VS-21); Sprint-5+ impl |
| Status | Draft (2026-05-08) — split: §A design-phase ACs (Sprint-4); §B impl-phase ACs (Sprint-5+) |

---

## §A — Sprint-4 design-phase ACs (SPEC + ADR + AC artifact quality)

### AC-S006-2.A1 — Safe action surface documented
**Given** SPEC-S006-2 §5.1,
**When** `/review` runs on the SPEC PR,
**Then** §5.1 lists exactly 3 actions, each with: action_id, description, inverse, "why safe" rationale; and the rejected actions list with rationale.

### AC-S006-2.A2 — Apply mechanism decided in ADR-013
**Given** Sprint-4 sprint exit,
**When** `docs/adr/ADR-013-closed-loop-apply-mechanism.md` exists,
**Then** it has Status / Context / Decision / Consequences / Alternatives sections; Decision = "git commit + Kargo + ArgoCD"; Alternatives explicitly rejects in-cluster kubectl with KubeCon EU 2026 source citation.

### AC-S006-2.A3 — Approval flow documented (no auto-apply)
**Given** SPEC §5.3,
**When** read,
**Then** the SPEC explicitly states: (1) UI Apply/Dismiss button is mandatory, (2) backend ServiceAccount has read-only RBAC, (3) Kargo `requiresVerification: true` enforces human approval, (4) audit log captures actor + action + commit SHA + LLM response ID.

### AC-S006-2.A4 — Observation harness bounded
**Given** SPEC §5.4,
**When** read,
**Then** the SPEC declares: (1) 5-min hard cap on observe window, (2) bounded poll cadence (30s), (3) MetricRipple shape with samples_n field, (4) no open-ended streaming.

### AC-S006-2.A5 — Rollback / Undo path defined
**Given** SPEC §5.5 and §5.1 inverse table,
**When** read together,
**Then** every action_id with non-null `inverse_action_id` is symmetric (action(params) ∘ inverse(params) ≈ identity at observable-state level); `restart_emulator_pod` explicitly documents that its inverse is null (rolling-restart is forward-only).

### AC-S006-2.A6 — Threat model populated
**Given** SPEC §5.6,
**When** read,
**Then** the table covers ≥ 8 threat-mitigation pairs spanning: hallucination, damage, forged request, race, PR flood, sync drift, observation stuck, inversion ambiguity.

### AC-S006-2.A7 — ADR-004 extension committed
**Given** Sprint-4 sprint exit,
**When** `docs/adr/ADR-004-llm-grounding-contract.md` opened,
**Then** it has a new section / clause stating: "AI suggestions targeting cluster state mutations require explicit human approval; auto-apply is forbidden." (cross-references SPEC-S006-2 §5.3).

### AC-S006-2.A8 — Open questions enumerated for Sprint-5
**Given** SPEC §7,
**When** Sprint-5 kickoff happens,
**Then** the §7 list serves as the Sprint-5 "design spike" agenda; nothing should reach Sprint-5 impl unanswered.

---

## §B — Sprint-5+ impl-phase ACs (deferred; documented now for traceability)

### AC-S006-2.B1 — `/runbook` returns structured ActionPlan
**Given** copilot-api running,
**When** client calls `POST /runbook` with anomaly context,
**Then** response body validates against `tests/contracts/copilot-response.schema.json` extension `runbook_v3` which adds `action_plan: { action_id, params, rationale, inverse_action_id, evidence }`. The 3 action_ids from SPEC §5.1 are the only allowed enum values.

### AC-S006-2.B2 — UI renders Apply / Dismiss for ActionPlan
**Given** UI Copilot panel renders a `RunbookResponse` with `action_plan`,
**When** user observes the panel,
**Then** there is a clearly-labeled `Apply` button and `Dismiss` button; rationale prose displayed above; clicking outside the panel does not auto-dismiss.

### AC-S006-2.B3 — Apply triggers backend with audit
**Given** user clicks Apply,
**When** the request fires,
**Then** `POST /action/{id}/apply` is called with bearer token; backend records `{ts, sub, action_id, action_params, scenario_id, llm_response_id}` to Loki `closed_loop_audit` stream **before** any git operation.

### AC-S006-2.B4 — Rate limit enforced
**Given** an action_id+params has been applied < 5 min ago for the same scenario_id,
**When** another Apply attempt hits backend,
**Then** response is HTTP 429 with body `{"status":"rate_limited","retry_after_seconds":<n>}`.

### AC-S006-2.B5 — Git commit lands on dedicated branch
**Given** an Apply succeeds rate-limit check,
**When** the action commits,
**Then** a new commit lands on branch `closed-loop/auto/<timestamp>-<sub>` with message `[closed-loop:<action_id>] sub=<sub> scenario=<id> llm_response=<id>`. Body includes the patched Kustomize fragment.

### AC-S006-2.B6 — Whitelist-only action_id
**Given** an Apply with `action_id` not in the SPEC §5.1 whitelist,
**When** request hits backend,
**Then** response is HTTP 422 `{"status":"unknown_action","error":"action_id not in whitelist"}`. No git operation. No audit log (request is rejected at validation layer).

### AC-S006-2.B7 — Observe returns metric ripple
**Given** an action committed N minutes ago (N ≤ 5),
**When** client calls `GET /action/{id}/observe?since=<ts>`,
**Then** response is `MetricRipple{baseline_p95, post_apply_p95, delta_pct, samples_n, status: "in_progress" | "complete"}`. After 5 min: `status: complete`, no new samples accepted.

### AC-S006-2.B8 — Undo round-trips
**Given** an action with non-null `inverse_action_id` was applied,
**When** Undo is clicked → inverse action applies → observation completes,
**Then** observable cluster state returns to the pre-action baseline (within ε = 5%); action audit log shows both apply + inverse-apply records.

### AC-S006-2.B9 — kind smoke test exercises all 3 actions
**Given** Sprint-5 close,
**When** `make k8s-smoke-closed-loop` runs against kind cluster,
**Then** it: (1) loads beam-degradation scenario, (2) applies `scale_copilot_api_replicas(2)`, observes ripple, undoes; (3) applies `restart_emulator_pod`, observes ripple; (4) applies `set_payload_mode(transparent)`, observes ripple, undoes. All steps green; total < 10 min.

### AC-S006-2.B10 — Anti-pattern self-audit on each impl PR
**Given** any Sprint-5+ PR closing a B-series AC,
**When** `/review` runs,
**Then** PR body has all 7+1 chains filled: Chain #1 grep-verify (action_id whitelist match SPEC §5.1), Chain #5 first-call-only (rate-limit second-call test), Chain #6 partial-migration (all 3 actions ship together).

---

## Open ACs (Sprint-6+ extensions)

- AC-S006-2.C1 — Multi-cluster targeting
- AC-S006-2.C2 — Argo Image Updater integration (if image-tag rotation enters action surface)
- AC-S006-2.C3 — Cost-aware action ranking (cluster price impact)
