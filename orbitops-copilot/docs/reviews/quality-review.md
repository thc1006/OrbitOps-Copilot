# Quality Review — OrbitOps Copilot

| Field | Value |
|---|---|
| Reviewer | senior code reviewer (single-pass repo audit) |
| Branch under review | `chore/repo-review` (off `baseline-sprint-1`) |
| Baseline commit | `8741078` |
| Date | 2026-04-30 |

## Method

13-dimension scan covering CLAUDE.md / AGENTS.md clarity, per-service test presence, TDD evidence, `make test` / `make verify` pass status, claim audit, anonymity, hook safety, demo stability, hallucination/injection risk. Findings ranked Critical / High / Medium / Low.

## Summary

| Dim | Result |
|---|---|
| 1. CLAUDE.md clarity | **PASS**. 14 numbered sections, explicit non-negotiables, MVP scope, forbidden scope, DoD. Engineering constitution well-structured. Single-file > 200 lines but tight. |
| 2. AGENTS.md cross-tool usability | **PASS** for Claude Code; **partial** for Codex CLI — explicit Codex section present (Setup / Test / Style / Security / Boundaries / PR), but no `agents.md` validator gate to catch drift. |
| 3. Per-service tests | **PASS** for the 4 Python services (scenario-generator 14, ntn-metrics-emulator 12, copilot-api 19, voice-interface 1) + integration 4. **FAIL** on `chore/repo-review` for digital-twin-ui (0 — PR #6 not yet merged). |
| 4. TDD evidence | **WEAK**. CLAUDE.md §12.2 demands "failing test commit before implementation" in git history. Actual history: each branch shipped a single squashed commit (`[CR-1] fix...`, `[VS-NEPHIO] ...`). Red→green→refactor sequence happened in-session but was not preserved. **High** finding (Q-3). |
| 5. `make test` | **PASS**. 50 + 1 xfailed pytest + 4 vitest todo + 4 integration + 1 PENDING (k8s smoke). 0 hard failures. |
| 6. `make verify` | **PASS**. 6/6 gates green: lint placeholder / unit tests / no-secrets / schema validation (3 schemas + 3 scenarios + 3 golden + 2 fixtures + drift detector) / k8s manifest / anonymity grep. |
| 7. Secrets | **CLEAN**. Zero AKID / OpenAI key / Anthropic key / GH token / private-key headers in tracked files. |
| 8. Unverified version pins | **DOCUMENTED**, not stale. `docs/mcp/01_mcp_candidates.md` and `docs/specs/SPEC-000` mark "verify before install" with explicit gh / curl commands. Acceptable. |
| 9. Exaggerated claims | **CLEAN**. Marketing-word grep returned 1 false positive in ADR-006 (rejecting an alternative). All capability statements scoped with "Sprint 1 stub" / "P2 future" hedges. `claims-audit` skill enforces this in `runspace-pitch` workflow. |
| 10. Identity exposure | **CRITICAL**. `Initial commit c3c698f` authored by `<real-name-redacted> <<noreply-email-redacted>>` — real name in public git history. Q-1 below. |
| 11. Demo replay | **GOOD**. Three exit paths: `scripts/run-demo.sh` (Sprint 0 placeholder), `scripts/demo-beam-quality.sh` (live process via curl), `tests/integration/test_beam_quality_copilot.py` (in-process). Deterministic via FakeLLMProvider; no LLM dependency. |
| 12. LLM hallucination / injection | **STRONG**. ADR-004 + PR-β (FakeLLMProvider evidence-relevance check) + PR-α (Pydantic `extra='forbid'`) + AC-003 explicit injection test + `_with_time_window_note` disclaimer. Provider sees **only structured evidence**, never raw user logs. |
| 13. Dangerous shell hooks | **CLEAN**. `.claude/settings.json`: zero hooks defined. Permissions deny `rm`, `curl`, `wget`, `git push --force`, `git config`, `sudo`, `chmod 777`. |

## Findings

### Q-1 (Critical) — Real name in public git history

`git log --all --format='%an <%ae>'` returns:
```
OrbitOps Copilot <anon@orbitops.local>
<real-name-redacted> <<noreply-email-redacted>>
```

The second author appears in **`Initial commit c3c698f`**, public on `https://github.com/<OWNER>/<REPO>`. CLAUDE.md §2 #1 forbids this for RunSpace anonymity.

**Why this is "Critical, not Low"**: even if every subsequent commit is anonymized, RunSpace evaluators (or any third party) running `git log` see the real name. The repo URL itself contains `<OWNER>`.

**Recommended fix**: see `docs/reviews/security-review.md` §S-1 for the remediation playbook (history rewrite + repo move). **Do not auto-fix** — rewriting public git history requires force-push to a public repo and is destructive; user must confirm.

### Q-2 (High) — Repo is public, exposes owner handle

`gh repo view --json isPrivate` returns `false`. The repo URL `<OWNER>/<REPO>` and every PR creator name `<OWNER>` are publicly visible. Same anonymity-rule violation as Q-1.

**Recommended fix**: `gh repo edit <OWNER>/<REPO> --visibility private --accept-visibility-change-consequences` OR move work to an anonymized GitHub account before RunSpace submission. **Do not auto-fix** (visibility is a personal-account-level decision).

### Q-3 (High) — TDD red→green→refactor not visible in git history

CLAUDE.md §12.2 mandates: "先寫**失敗**的測試（commit 1：紅），再實作（commit 2：綠），再重構（commit 3：仍綠）。三步可合併但失敗測試必須先存在於 git history。"

Actual history per branch:

```
$ git log --oneline feat/VS-2-observability-stack
20f20d5 [VS-2] observability stack: docker-compose + Prom + Grafana + check script
8741078 Sprint 1 VS-1 baseline + R3 review
```

The branch ships as **one** commit. The red→green pivot happened in-session but was never committed separately. Audit cannot verify "test was written first".

**Recommended fix (process, not auto-fix)**: per future PR, require `red:` and `green:` commits as separate steps. Add a CI lint job that scans git history per branch for at least one `red:` commit before merge. Issue I-3 in `docs/reviews/issues.md` has the script outline.

### Q-4 (Medium) — `digital-twin-ui` placeholder on baseline; real shell on PR #6

On `baseline-sprint-1` HEAD = `8741078`, `services/digital-twin-ui/src/CopilotPanel.spec.tsx` has 4 `test.todo()` and `main.tsx` is a one-line `<App />` placeholder. The real SVG shell + 11 vitest tests live on PR #6 unmerged.

This is **expected** (PR #6 is the implementation), but a fresh clone of `main` post-baseline-merge will show 0 functional UI tests until PR #6 lands. Operationally fine; mention in `PROJECT_STATUS.md` so reviewers know.

### Q-5 (Medium) — `digital-twin-ui` package.json future version pins (on baseline)

```json
"react": "19.2.5", "vite": "8.0.10", "vitest": "3.0.0", "tailwindcss": "4.2.4", "typescript": "6.0.3"
```

These versions **don't exist on npm registry today**. `npm install` would fail. PR #6 fixes this by pinning to today-stable versions (React 18.3, Vite 5.4, etc.).

**Auto-fix viable**: not for this branch (scope = review only); merge PR #6 to fix. Captured as I-5.

### Q-6 (Medium) — `voice-interface` has 1 test (xfail), no impl

```
services/voice-interface/tests/test_voice_red.py: 1 xfailed
```

The test is xfail-strict per Sprint 2 task S2-07. By design but worth noting that voice is not on Sprint 1 critical path.

### Q-7 (Low) — `make test` reports 1 PENDING for k8s-smoke

Acceptable per CLAUDE.md "PENDING in Sprint 0/1 OK; CI tightens later". PR #8 (VS-6) ships the actual smoke script; merging it closes this.

### Q-8 (Low) — `verify.sh` lint gate is placeholder

```bash
$ make verify
[verify] 1/6 format & lint (placeholder for Sprint 0)
```

ruff runs but warnings are tolerated. Acceptable for Sprint 1; Sprint 2 should harden to fail-on-warning.

## Decision matrix

| ID | Severity | Auto-fix this PR | Reason |
|---|---|---|---|
| Q-1 | Critical | **NO** | Destructive: requires force-push to public repo; user-only |
| Q-2 | High | **NO** | Account-level visibility change; user-only |
| Q-3 | High | **NO** | Process change; needs CI work; adds I-3 + automation script |
| Q-4 | Medium | NO | Resolved by merging PR #6 |
| Q-5 | Medium | NO | Resolved by merging PR #6 |
| Q-6 | Medium | NO | Sprint 2 scope |
| Q-7 | Low | NO | Acceptable per process |
| Q-8 | Low | NO | Sprint 2 scope |

**Auto-applied this PR**: only Q-3 instrumentation — a `verify.sh` advisory check that warns on commits whose author email is not in an allowlist. Pure additive, no existing code touched, no false positive on existing history.

## Verification

After this PR:
- `make verify` 6/6 green (unchanged)
- New advisory: `verify.sh` will print one WARN per non-allowlisted author, but **does not fail** the gate (so existing leaked initial commit doesn't break CI; gives operator clear signal to fix Q-1 + Q-2 manually).
