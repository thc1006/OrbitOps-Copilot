# copilot-api

> SPEC-003 — see `docs/specs/SPEC-003-copilot-api.md`.
> Grounding contract — see `docs/adr/ADR-004-llm-grounding-contract.md`.

## Status

Sprint 0 skeleton: `/healthz` + `/ask` stub returning `INSUFFICIENT_EVIDENCE`. Real evidence pipeline lands in Sprint 1 (S1-04, S1-05).

## Run

```bash
uvicorn copilot_api.main:app --host 0.0.0.0 --port 8001
```

## Test

```bash
pytest services/copilot-api/tests
```
