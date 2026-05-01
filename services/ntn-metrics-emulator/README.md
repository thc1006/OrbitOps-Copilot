# ntn-metrics-emulator

> SPEC-002 — see `docs/specs/SPEC-002-ntn-metrics-emulator.md`.

## Status

Sprint 0 skeleton: `/healthz` only. `/metrics`, scenario load, anomaly inject land in Sprint 1 (S1-02, S1-03).

## Run

```bash
uvicorn ntn_metrics_emulator.main:app --host 0.0.0.0 --port 8000
```

## Test

```bash
pytest services/ntn-metrics-emulator/tests
```
