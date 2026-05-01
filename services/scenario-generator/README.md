# scenario-generator

> SPEC-001 — see `docs/specs/SPEC-001-scenario-generator.md`.

## Status

Sprint 0 skeleton. Real implementation lands in Sprint 1, slice **S1-01**.

## Run (Sprint 1+)

```bash
.venv/bin/python -m scenario_generator generate --scenario beam-degradation \
  --seed 42 \
  --out packages/scenarios/beam-degradation.json
```

## Test

```bash
pytest services/scenario-generator/tests
```
