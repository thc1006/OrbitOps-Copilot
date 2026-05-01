# ADR-007 — Schema v1→v2 migration (scenario + metrics + copilot-response + emulator API)

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-04-30 |
| Deciders | architect, ran-ntn-engineer, observability-engineer, llm-copilot-engineer |
| Supersedes | n/a |
| Related | SPEC-001, SPEC-002, SPEC-003, ADR-001, ADR-004, `docs/contracts/metrics.md`, `docs/mcp/04_mcp_decision_record.md` |

## Context

Three v1 contract drafts written in Sprint 0 (`tests/contracts/scenario.schema.json`, `tests/contracts/metrics.schema.json`, `tests/contracts/copilot-response.schema.json` + the API path conventions in SPEC-002) all needed amendment when each implementer turn started in Sprint 1:

1. **Scenario v1** had nested `pass_window`, `ground_station`, `satellite`, `anomaly_injection`, `expected_runbook_keywords`. The /implement SPEC-001 prompt requested flat `start_time`, `duration_seconds`, `satellite_id`, `ground_station_id`, `events`, `expected_anomaly`.
2. **Metrics v1** used names like `orbitops_snr_db`, `orbitops_latency_ms`, `orbitops_pod_health`. The /implement SPEC-002 prompt requested `orbitops_beam_snr_db`, `orbitops_link_latency_ms`, and added `orbitops_gateway_available`; dropped `orbitops_pod_health`, `orbitops_handover_failures_total`, `orbitops_elevation_deg`.
3. **Emulator API v1** used plural `/scenarios/load`, `/scenarios/current`, `/anomaly/inject`. The /implement SPEC-002 prompt requested singular `/scenario/load`, `/scenario/current`, plus a new `/scenario/tick` and removed `/anomaly/inject`.
4. **Copilot response v1** was `{answer, runbook, evidence}`. The /implement SPEC-003 prompt expanded /runbook output to `{summary, likely_cause, evidence, recommended_actions, risk_if_ignored, confidence, unknowns}` and added `REFUSED` status.

Each amendment was applied inline in its implementer turn; this ADR is the consolidated record. Per CLAUDE.md §12.1 SDD discipline, breaking schema changes require an ADR.

## Decision

Adopt v2 across all four contract surfaces. v1 artifacts (sample scenarios, golden expected, schema enums, route paths) are **deleted**, not aliased. Migration table below is canonical.

### scenario.schema v1→v2 migration

| v1 field | v2 field | Note |
|---|---|---|
| `pass_window.start` | `start_time` | flat date-time |
| `pass_window.end` | (removed) | computed from `start_time + duration_seconds` |
| n/a | `duration_seconds` | new top-level integer |
| `ground_station.id` | `ground_station_id` | flat string |
| `ground_station.{lat,lon,alt_m}` | (removed) | not used by emulator; reintroduce P2 if needed |
| `satellite.id` | `satellite_id` | flat string |
| `satellite.payload_mode` | (removed) | scenario level; reintroduce P2 if downstream needs |
| `satellite.tle_line1/2` | (removed) | P2 only |
| `anomaly_injection[]` | `events[]` | renamed |
| `anomaly_injection[*].t_offset_s` | `events[*].t_offset_seconds` | spelled out |
| `anomaly_injection[*].duration_s` | `events[*].duration_seconds` | spelled out |
| `anomaly_injection[*].type` enum: `handover_failure_burst`, `gateway_pod_unhealthy` | `events[*].type` enum: `handover_failure`, `gateway_outage` | shorter, less colloquial |
| `expected_runbook_keywords[]` | `expected_anomaly.{type,target,keywords[]}` | typed object instead of bare list |

### metrics v1→v2 migration

| v1 name | v2 name | Note |
|---|---|---|
| `orbitops_snr_db` | `orbitops_beam_snr_db` | added `beam_` prefix |
| `orbitops_sinr_db` | `orbitops_beam_sinr_db` | same |
| `orbitops_latency_ms` | `orbitops_link_latency_ms` | added `link_` prefix |
| `orbitops_packet_loss_ratio` | `orbitops_packet_loss_ratio` | unchanged |
| `orbitops_doppler_residual_hz` | `orbitops_doppler_residual_hz` | unchanged |
| `orbitops_elevation_deg` | (removed) | folded into baseline SNR |
| `orbitops_handover_state{beam_id,state}` one-hot | `orbitops_handover_state{beam_id}` enum 0/1/2 | numeric state machine |
| `orbitops_handover_failures_total` Counter | (removed) | replaced by `orbitops_handover_state == 2` + `orbitops_anomaly_active{type=handover_failure} == 1` |
| `orbitops_pod_health` | (removed) | replaced by `orbitops_gateway_available` |
| n/a | `orbitops_gateway_available{gateway_id}` | new |
| `orbitops_anomaly_active{type,target}` | `orbitops_anomaly_active{type}` | dropped `target` label |

### Emulator API v1→v2

| v1 path | v2 path | Note |
|---|---|---|
| `POST /scenarios/load` | `POST /scenario/load` | singular |
| `GET /scenarios/current` | `GET /scenario/current` | singular |
| `POST /anomaly/inject` | (removed) | replaced by deterministic `POST /scenario/tick` |
| n/a | `POST /scenario/tick` | new; advances simulated `t` by `seconds` |

### Copilot response v1→v2

| v1 field | v2 field | Note |
|---|---|---|
| `answer: str\|null` | `summary: str\|null` + `likely_cause: str\|null` | split |
| `runbook: list[RunbookStep] (1..5)` | `recommended_actions: list[RecommendedAction]` (≥0) | renamed; not strict 5-step |
| `evidence.confidence` | `confidence` (top-level) | promoted out of evidence |
| n/a | `risk_if_ignored: str\|null` | new |
| n/a | `unknowns: list[str]` | new (epistemic humility) |
| n/a | `time_window_seconds` (in evidence) | new |
| `status` enum + `ok\|INSUFFICIENT_EVIDENCE\|ERROR` | added `REFUSED` | new (out-of-domain refusal) |
| n/a | `refusal_reason: str\|null` | new |

## Consequences

**Positive:**
- v2 names are more grep-friendly (`orbitops_beam_*`, `orbitops_link_*`).
- Deterministic `/scenario/tick` replaces background tick loop → testable without sleep, no race conditions.
- Copilot response `unknowns` field forces the LLM to list what it doesn't know — a rare but powerful epistemic primitive.
- `REFUSED` status separates "can't answer because no evidence" from "won't answer because out-of-scope".

**Negative:**
- Two-cycle migration (Sprint 0 wrote v1, Sprint 1 implementers each wrote v2) cost ~1 PR worth of churn per surface. Avoidable next time by labelling v1 as `Status: tentative — finalised at first /implement`.
- Grafana dashboard JSON, AC-001 metric reference, and downstream docs lag the v2 contract by one PR (now closing in this batch).

**Operational:**
- v1 was never deployed (Sprint 0 was placeholder). No production data dependent on v1 names; migration cost is purely internal docs / tests / golden snapshots.

## Alternatives considered

1. **Keep v1, add v2 as alias layer** — rejected. Doubles surface area without value; v1 was never observed by anything.
2. **Bump SPEC-001/002/003 to use v1, override only via inline implementer notes** — rejected. Violates "spec is single truth" rule; future `/implement` calls would re-read v1 spec and re-spawn the conflict.
3. **Defer migration until Sprint 2** — rejected. Each implementer needs the contract stable; deferring means each runs against a different draft.

## Conditions for re-evaluation

- v3 migration becomes necessary only if a downstream consumer (Grafana dashboard, Copilot grounding test, RunSpace pitch claim) demands a name shape we cannot satisfy with v2.
- Adding metrics is a compatible extension (append to schema enum + dashboard); does not require v3.
- Removing metrics or renaming labels is breaking → would require ADR-N.

## Rollback

Pure git revert of the SDD reconciliation commits in each implementer turn restores v1. No data migration is needed (all v1 artifacts were dev-only).

## References

- SPEC-001 §6/§7 (Schema version: v2)
- SPEC-002 §7 (Contract version: v2)
- SPEC-003 §7 (response shape v2)
- `docs/contracts/metrics.md` §3 + §7 (migration table mirrored)
- `tests/contracts/{scenario,metrics,copilot-response}.schema.json` v2
