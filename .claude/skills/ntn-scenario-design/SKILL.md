---
name: ntn-scenario-design
description: Design and validate NTN scenarios (beam-degradation, handover-failure, gateway-fallback) — JSON conforming to scenario.schema.json with realistic Rel-19 wording.
---

## Overview

Authoritative skill for authoring or modifying scenario JSON files in `packages/scenarios/`. Every scenario must validate against `tests/contracts/scenario.schema.json`; metrics produced from it must validate against `tests/contracts/metrics.schema.json`. Wording aligns with 3GPP Rel-19 (`payload_mode: transparent | regenerative`, `handover_state`, `doppler_residual`).

## Triggers

- Adding a new anomaly type for UC1 / UC2 demos.
- Tuning anomaly magnitudes / timings for the golden test set.
- Slash command `/plan` lands a SPEC requesting a new scenario.

## Inputs

- A textual scenario brief (e.g., "Doppler spike at low elevation, regenerative payload, single-beam").
- `packages/scenarios/*.json` existing samples for reference.
- `docs/00_research_2026_04.md` §2.5 for Rel-19 vocabulary.

## Step-by-step workflow

1. Pick the closest existing JSON as starting point.
2. Modify only the necessary fields: `scenario_id`, `description`, `anomaly_injection[]`, `expected_runbook_keywords`.
3. Keep `payload_mode` ∈ {`transparent`, `regenerative`} — Rel-19 wording.
4. Anomaly magnitudes within physical sanity:
   - SNR drop: 3–15 dB
   - Doppler spike: 100 Hz – 10 kHz
   - packet_loss: ≤ 0.5
   - elevation: 0–90°
5. Run `python3 scripts/validate_schemas.py` — must pass.
6. If new anomaly **type** is introduced, update `tests/contracts/scenario.schema.json` enum **and** update `services/ntn-metrics-emulator` SPEC-002 in the same PR.
7. Add `tests/golden/<scenario-id>.expected.json` with metric assertions and copilot assertions.
8. Reference matching SPEC-001 / AC-004 in PR body.

## Output format

A new or modified `packages/scenarios/<id>.json` plus matching `tests/golden/<id>.expected.json`. Both validate against contract schemas.

## Verification checklist

- [ ] `python3 scripts/validate_schemas.py` passes (skill must pass).
- [ ] `expected_runbook_keywords` non-empty and tied to actual scenario content.
- [ ] No PII / team / school in `description` or `notes`.
- [ ] `./verify.sh` clean.

## Common failure modes

- Forgetting to add a new anomaly type to the schema enum → schema validation fails.
- Out-of-range physical values (SNR = 200 dB, elevation = -10°) → caught by schema bounds.
- Adding fields not in scenario schema with `additionalProperties: false`.
- Re-using an existing `scenario_id` → golden test conflicts.

## Forbidden actions

- Claiming real RF / Ka-band physics beyond the emulator's contract.
- Editing emulator code or copilot prompts (other skills).
- Inventing satellite TLEs without explicit `tle_line1` / `tle_line2` from public sources (or leave omitted; schema allows).
