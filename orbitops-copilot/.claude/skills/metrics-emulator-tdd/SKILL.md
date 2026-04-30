---
name: metrics-emulator-tdd
description: Implement ntn-metrics-emulator features TDD-style — red commit (failing test) → green commit (impl) → refactor. Strictly per SPEC-002 + metrics.schema.json.
---

## Overview

The disciplined workflow for landing slices in `services/ntn-metrics-emulator/`. Pure-function tick model `(scenario, t) -> metrics` exposed as Prometheus exposition at `/metrics`. Every metric obeys `tests/contracts/metrics.schema.json`.

## Triggers

- Sprint-1 slices S1-02 / S1-03 (or any subsequent emulator slice).
- Any change to metric names, labels, or tick semantics.
- Slash command `/implement SPEC-002`.

## Inputs

- `docs/specs/SPEC-002-ntn-metrics-emulator.md`
- `docs/acceptance/AC-001 / AC-002 / AC-004 .md`
- `tests/contracts/metrics.schema.json`
- Existing red tests in `services/ntn-metrics-emulator/tests/test_spec_002_red.py`

## Step-by-step workflow

1. **Locate red test** for the slice in `test_spec_002_red.py`. If none, write one (assert against the future SPEC behavior, mark `@pytest.mark.xfail(strict=True)`).
2. **Red commit**: ensure the test currently fails. Commit with title `red(SPEC-002): test_<feature_name> documents future behavior`.
3. **Remove `@pytest.mark.xfail`** in a separate commit titled `tdd(SPEC-002): unmark <test> for implementation`.
4. **Implement** minimum code in `services/ntn-metrics-emulator/src/ntn_metrics_emulator/` to make it green. Use `prometheus-client` `Gauge`/`Counter` per metrics.schema enum. Keep tick deterministic.
5. **Green commit**: title `feat(SPEC-002): <feature>`.
6. **Run** `pytest services/ntn-metrics-emulator/tests -q` — green.
7. **Run** `./verify.sh` — all 6 gates green.
8. **Refactor** if needed; tests must stay green.
9. **Update**: `docs/agile/backlog.md` mark slice complete; `PROJECT_STATUS.md` updated.

## Output format

Three (or more) commits in this exact order:
1. `red(SPEC-002): ...` — test added, marked xfail-strict, fails as documented.
2. `tdd(SPEC-002): unmark ...` — xfail removed, test now actually fails.
3. `feat(SPEC-002): ...` — implementation, test green.

`git log --oneline -5` must show this red→unmark→green pattern.

## Verification checklist

- [ ] `pytest services/ntn-metrics-emulator/tests -q -v` green; XFAIL count consistent with remaining unimplemented red tests.
- [ ] `curl localhost:8000/metrics | grep orbitops_` returns expected gauges.
- [ ] `./verify.sh` 6/6.
- [ ] No new metric names absent from `tests/contracts/metrics.schema.json` enum.
- [ ] Tick latency < 50 ms (manual benchmark in PR body for changes affecting tick loop).

## Common failure modes

- Skipping the red commit (most common TDD violation). PR will be rejected.
- Adding a metric name to emulator without updating schema enum first.
- Non-deterministic tick (e.g., raw `random()` without seed) — break golden replay.
- Reading scenario at every tick (slow); should load once.

## Forbidden actions

- Writing to disk during tick.
- Calling LLM (that's `copilot-api`).
- Bypassing schema by using `Gauge.labels(**arbitrary_labels)`.
- Making the emulator depend on a real RAN stack / SDR.
