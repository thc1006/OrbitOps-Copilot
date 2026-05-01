---
name: demo-replay-hardening
description: Make the AC-004 demo replay deterministic, recordable, and resilient to network blips / LLM provider failure.
---

## Overview

Goal: a single command (`scripts/run-demo.sh`) brings up dev stack, replays a golden scenario, captures evidence to `tmp/demo-output.json` that satisfies AC-004, in ≤ 90 seconds — even on a flaky network. Crucial for live demo days.

## Triggers

- Editing `scripts/run-demo.sh`.
- Adding / changing a golden scenario or its expected file.
- Before any RunSpace recording session or live evaluation.
- Slash command `/demo`.

## Inputs

- `docs/acceptance/AC-004-demo-replay.md`
- `packages/scenarios/*.json`
- `tests/golden/*.expected.json`
- Current state of `services/*` and `deploy/docker-compose.yml`.

## Step-by-step workflow

1. **Determinism**: confirm emulator tick uses a seed (or no random) so identical scenario → identical metrics within tolerance.
2. **Health gates**: script polls `/healthz` for emulator + copilot before triggering anomaly. Time budget: 30 s with 1-second polls.
3. **Provider fallback**: if `COPILOT_LLM_PROVIDER` real provider fails, script falls back to `mock` provider for the demo (set env var, restart copilot pod / container).
4. **Capture**: write `tmp/demo-output.json`; validate against `tests/contracts/copilot-response.schema.json`.
5. **Compare**: assert `tmp/demo-output.json` against `tests/golden/<id>.expected.json` (op-aware: `==`, `<`, `contains_any`, `length_eq`, `non_empty`).
6. **Screenshot** (P1+): `playwright` or curl the Grafana renderer and save `tmp/demo-screenshot.png`.
7. **Cleanup**: `make dev-down` always runs (trap EXIT).
8. **Time gate**: total wall-time ≤ 90 s; abort with clear log if exceeded.

## Output format

- Updated `scripts/run-demo.sh` with `set -euo pipefail` + EXIT trap.
- `tmp/demo-output.json` validates against schema and matches golden assertions.
- Optional `tmp/demo-screenshot.png`.

## Verification checklist

- [ ] Run twice in a row → identical `tmp/demo-output.json` (within numeric tolerance).
- [ ] Kill copilot mid-demo → script either retries or fails clearly (no fake green).
- [ ] Total runtime < 90 s on a clean dev machine.
- [ ] All AC-004 assertions pass.
- [ ] No secrets / no anonymity leaks in logged output.
- [ ] Trap-EXIT cleanup runs even on Ctrl-C.

## Common failure modes

- LLM provider outage → demo silently produces `INSUFFICIENT_EVIDENCE` and tester misreads as bug.
- Container start race → script queries `/metrics` before scrape window populated.
- Local clock drift makes "after_anomaly_t_s" assertions miss.
- Forgetting to gitignore `tmp/` → demo screenshots leak into commits.

## Forbidden actions

- Hard-coding a "demo passed" output independent of actual results.
- Skipping schema validation to "make the demo green".
- `kubectl delete` outside `orbitops` namespace.
- Uploading captured demo artifacts to external storage from within the script.
