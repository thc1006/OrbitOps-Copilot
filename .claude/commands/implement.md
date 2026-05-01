---
description: Implement a slice using TDD — failing test commit, then green commit. Strictly per its SPEC + AC.
argument-hint: <SPEC-NNN>
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(make *), Bash(./verify.sh), Bash(./test.sh), Bash(pytest *), Bash(ruff *), Bash(npm *), Bash(npx *)
---

Implement slice **$ARGUMENTS** following TDD.

Procedure:

1. Read the corresponding `docs/specs/SPEC-$ARGUMENTS-*.md` and `docs/acceptance/AC-*.md` it references.
2. **Red commit**: write failing tests first under `services/<svc>/tests/` and `tests/` as appropriate. Run `pytest`/`vitest`; confirm they FAIL with the expected error. Commit.
3. **Green commit**: implement the minimum code to pass. Run `make verify` until all green. Commit.
4. **Refactor commit (optional)**: clean up while tests stay green.
5. Update `docs/agile/backlog.md` (mark slice complete) and `PROJECT_STATUS.md`.

Hard constraints:

- Every copilot response must conform to `tests/contracts/copilot-response.schema.json` and contain `evidence`.
- No `console.error` in TS; no `print` in Python.
- No team / school / personal identifiers.
- No `--no-verify` commits.
- Do not implement features outside the SPEC.

Report which commits you made and final `make verify` summary.
