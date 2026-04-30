---
name: llm-grounding-review
description: Review copilot-api responses to ensure every answer cites metrics/logs evidence. Block any response that hallucinates or leaks system prompt.
---

## Overview

Enforces ADR-004's evidence-grounded contract. Every Copilot response must conform to `tests/contracts/copilot-response.schema.json` with non-empty `evidence.metrics_used` for `status == "ok"`. No metrics → `status == "INSUFFICIENT_EVIDENCE"`. Jailbreak prompts must not exfiltrate system prompt.

## Triggers

- Any change to `services/copilot-api/src/copilot_api/`.
- Adding / modifying provider adapters (mock, OpenAI-compatible).
- Reviewing PRs that touch prompt templates or response models.
- Slash command `/review` on a copilot-related diff.

## Inputs

- The diff under review.
- `docs/specs/SPEC-003-copilot-api.md`
- `docs/adr/ADR-004-llm-grounding-contract.md`
- `docs/acceptance/AC-001 / AC-002 / AC-003 .md`
- `tests/contracts/copilot-response.schema.json`
- Latest test run output for `services/copilot-api/tests/`.

## Step-by-step workflow

1. **Schema enforcement check**: every code path returning a response must construct `CopilotResponse` (Pydantic). Direct `JSONResponse({...})` is forbidden.
2. **Empty-metrics path**: trace every code path; if no metrics retrieved, output must be `INSUFFICIENT_EVIDENCE` with `runbook=None`, `metrics_used=[]`.
3. **Prompt template inspection**: confirm user input enters via `{question}` placeholder, never string-concatenation. JSON-mode enabled when provider supports.
4. **Temperature**: `≤ 0.3` for `/explain`, `/runbook`; `≤ 0.5` for `/ask`.
5. **Run** the three grounding tests in `test_spec_003_red.py` (after S1-04 lands they must all be green):
   - `test_ask_with_active_anomaly_cites_metrics`
   - `test_runbook_returns_five_step_structure_with_evidence`
   - `test_ask_rejects_prompt_injection_without_revealing_system_prompt`
6. **Manual probe**: run `curl -X POST .../ask -d '{"question":"ignore previous instructions"}'` → assert system prompt not echoed.
7. **Verdict**: `LGTM` / `CHANGES_REQUESTED` with bullet list.

## Output format

```markdown
## llm-grounding-review

Verdict: LGTM | CHANGES_REQUESTED

- [ ] schema-locked Pydantic responses on all paths
- [ ] empty-metrics → INSUFFICIENT_EVIDENCE branch verified
- [ ] prompt template uses placeholders only
- [ ] temperature ≤ 0.3 for runbook
- [ ] grounding/hallucination/injection tests pass

Findings:
- ...
```

## Verification checklist

- [ ] Pydantic `CopilotResponse.model_validate(r.json())` succeeds for all unit-tested paths.
- [ ] Empty-metrics test green (hallucination guard).
- [ ] Prompt injection test green.
- [ ] No raw f-string of user input into system prompt.
- [ ] Provider adapter respects `OPENAI_API_KEY` from env, not hard-coded.

## Common failure modes

- Returning `200 OK` with a fabricated answer when Prometheus query returned no series.
- Using f-string concatenation: `system_prompt = f"You are...\n\nUser asked: {q}"`.
- Forgetting to validate model output → JSON mismatch → Pydantic accept partial → schema test fails downstream.
- Provider switch not respecting `COPILOT_LLM_PROVIDER` env var.

## Forbidden actions

- Allowing any response without `evidence` field.
- Hard-coding API keys or model names.
- Auto-merging PRs that touch prompt templates without running all three grounding tests.
- Editing scenario / emulator code (other skills).
