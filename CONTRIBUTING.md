# Contributing

> Read `CLAUDE.md` first — the engineering constitution is binding.

## Workflow

1. **Pick a slice from `docs/agile/backlog.md`**. Each slice is 1–2 days, vertical (spec + test + code + docs).
2. **Branch**: `feat/SPEC-NNN-slug` / `fix/<short-slug>` / `docs/<short-slug>`.
3. **TDD red-then-green**: commit a failing test first. Subsequent commits make it green. The git history must show a red→green transition.
4. **Run `make verify`** locally. CI enforces it again.
5. **PR**: title `[SPEC-NNN] <imperative>`; body must reference SPEC, AC, ADR.
6. **Anonymity**: do **not** commit team / school / personal identifiers, real e-mails, or internal URLs. `scripts/check-no-secrets.sh` will block.

## Definition of Done

See `docs/agile/definition-of-done.md`. Every PR must satisfy the **Single PR** column; every sprint exit must satisfy **Sprint exit**; every RunSpace submission must satisfy **發行**.

## Code style

- Python: ruff for lint+format; pytest; type hints required on public functions.
- TypeScript: tsc strict; no `any`; ESLint + Prettier.
- Shell: `set -euo pipefail`; long-form flags.

## Commit messages

- Imperative present tense ("add", "fix", "refactor"), not past.
- Reference SPEC/AC/ADR IDs where relevant.
- No team / school / personal identifiers.
- Keep first line ≤ 72 chars.

## ADR / SPEC additions

- Use the next available NNN (no skipping); template in `docs/04_technical_decisions.md` (for ADR) and `docs/specs/SPEC-001-...md` (as example).
- Status field: `Proposed` → `Accepted` after review.

## Test policy

- Unit + contract + golden — at least one of each per service.
- LLM tests: grounding + hallucination + injection.
- Don't silently skip; use `xfail(strict=True)` or `it.todo()` for not-yet-implemented.

## Reporting issues

- File issues with reproducible steps and reference SPEC/AC IDs.
- Security issues: see `SECURITY.md` (P1 to add).
