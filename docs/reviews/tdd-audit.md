# TDD Audit — OrbitOps Copilot

| Field | Value |
|---|---|
| Auditor | TDD auditor |
| Branch under review | `chore/repo-review` |
| Standard | CLAUDE.md §12.2 — "失敗測試必須先存在於 git history" |
| Date | 2026-04-30 |

## Method

For every feature branch off baseline `8741078`, inspect git log for evidence of a red commit (failing test added) preceding a green commit (implementation). Acceptance: at least 1 red-tagged commit per branch, OR clear evidence test files predate impl files in commit history.

## Branch-by-branch audit

| Branch | Commits | Red commit? | Verdict |
|---|---|---|---|
| `fix/CR-1-ac001-confidence-v2-path` | `f4c3775` (1 commit) | ❌ no separate red commit | **WEAK** |
| `feat/H-1-scraper-content-type-guard` | `22f7058` (1) | ❌ | WEAK |
| `fix/H-3-tighten-ac001-degrad-and-autouse-reset` | `749b789` (1) | ❌ | WEAK |
| `fix/H-2-time-window-disclaimer` | `adc4c98` (1) | ❌ | WEAK |
| `feat/VS-1.5-digital-twin-ui-svg-shell` | `ab35aab` (1) | ❌ | WEAK |
| `feat/VS-2-observability-stack` | `20f20d5` (1) | ❌ | WEAK |
| `feat/VS-6-k8s-deployment` | `627405b` (1) | ❌ | WEAK |
| `feat/VS-NEPHIO-stub-and-future-doc` | `73e5a6e` (1) | ❌ | WEAK |

**Score: 0/8 branches preserve the red→green commit chain.**

## What actually happened

In-session, every branch followed the discipline:

1. Read SPEC + AC.
2. Wrote failing test → ran pytest, observed failure.
3. Implemented minimum code → re-ran pytest, observed pass.
4. Committed.

Step 4 conflated steps 2+3 into one commit. Per CLAUDE.md §12.2 this is **explicitly allowed** ("三步可合併") — but only "如果失敗測試必須先存在於 git history". Single-commit branches do not preserve the red state in history.

**Audit verdict**: technically violates CLAUDE.md §12.2 second-clause invariant, even though in-session behavior was correct.

## Why this matters

A future contributor / RunSpace reviewer / archived-repo reader cannot prove TDD from `git log` alone. The discipline has degenerated to "trust the author's word".

The ground-truth fix: per future PR, two-commit minimum:

```bash
# commit 1: red
git add tests/...
git commit -m "red(SPEC-NNN): add failing test for X"

# verify it actually fails:
pytest tests/ -k test_X  # expect FAIL

# commit 2: green
git add src/...
git commit -m "green(SPEC-NNN): implement X"

# verify it passes:
make verify
```

## Specific quality of test code

Where tests exist, audit shows:

| Service | Test depth |
|---|---|
| scenario-generator (14 tests) | strong: list_scenarios + per-scenario schema valid + AC-001 invariants + determinism + unknown raises + golden snapshot + write_to + CLI exit codes + drift cross-ref + validate=True/False |
| ntn-metrics-emulator (12) | strong: healthz + load valid + load invalid 400 + tick 409 + metrics endpoint exposes all metric names + content-type + scenario load summary + tick deterministic + current 404 + integration with scenario JSON |
| copilot-api (19+) | strongest: REFUSED + INSUFFICIENT (4 paths) + ok grounded + 5-step runbook + schema validation + injection guard + Pydantic extra=forbid (3 tests) + irrelevant-evidence degrade (3 tests) + handover/gateway positive (2 tests) + time_window disclaimer (3 tests) |
| voice-interface (1, xfail) | minimal — Sprint 2 scope |
| integration (4) | end-to-end happy path + no-anomaly INSUFFICIENT + REFUSED + no-scraper |
| digital-twin-ui (PR #6, 11) | Comprehensive: layout + anomaly banner + beam cards + critical SNR formatting + ok branch + REFUSED + INSUFFICIENT + Enter-to-submit |

**Verdict on test quality**: strong. Coverage of failure modes (REFUSED, INSUFFICIENT, ERROR, schema violation, prompt injection) is unusual depth for Sprint 1 — counterbalances the missing red→green git history.

## Coverage gaps

| Gap | Sprint |
|---|---|
| copilot-api: real `OpenAICompatibleProvider` round-trip vs Ollama | Sprint 2 (S2-08) |
| emulator: Prom recording rules `promtool check rules` | Sprint 2 |
| UI: e2e Playwright smoke against running stack | Sprint 3 |
| LLM provider eval harness | Sprint 3+ |

All on backlog; not regressions.

## scripts/check-tdd-discipline.sh

Initially shipped advisory by this audit's PR. **Upgraded 2026-05-02** by `chore/tdd-discipline-blocking` to support `--mode=blocking`:

| Mode | When | Behavior |
|---|---|---|
| advisory (default) | `verify.sh` gate 1b on every push, including legacy branches | Warn-only; exit 0 always |
| blocking | CI job `tdd-discipline` on `pull_request` only | Exit 1 when production code touched (services/**/*.py\|.ts\|.tsx) without `^red[(:]` ancestor and without `[skip-tdd]` escape |

Operator can still run ad-hoc: `BRANCH=feat/foo BASE=main ./scripts/check-tdd-discipline.sh` (advisory) or `--mode=blocking` to dry-run the CI gate locally.

Self-test: `./tests/unit/test_check_tdd_discipline.sh` exercises 5 paths (red+green pass / missing-red fail / docs-only out-of-scope / `[skip-tdd]` hatch / advisory never blocks). The CI job runs this before the live gate so a regex regression can't silently flip the gate's polarity.

## Recommendations

| ID | Action | Sprint | Status |
|---|---|---|---|
| T-1 | Per-PR rule: ≥ 2 commits, first matches `^red[(:]`; documented in `scripts/check-tdd-discipline.sh` header comment + the CI gate's failure message. | Sprint 1 | **Documented 2026-05-02 by `chore/tdd-discipline-blocking`** |
| T-2 | CI job `tdd-discipline` enforces T-1 on PRs that touch production code (services/**/*.py\|.ts\|.tsx). Out-of-scope filter for docs/CI/deploy/scripts changes. `[skip-tdd]` escape hatch for justified edge cases. | Sprint 2 | **Resolved 2026-05-02 by `chore/tdd-discipline-blocking`** — blocking gate live; self-tested in `tests/unit/test_check_tdd_discipline.sh` (5 paths). |
| T-3 | Add an integration test for `_grounding.is_supported_question` heuristic boundary cases. | Sprint 2 | Open |
| T-4 | Wire `coverage.py` over copilot-api → fail PR if coverage < 80%. | Sprint 2 | Open |
