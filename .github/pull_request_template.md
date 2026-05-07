<!--
PR template — OrbitOps Copilot.
Source: post-Sprint-3 harvest (2026-05-07).
Anti-pattern checklist: docs/reviews/anti-pattern-checklist.md
PR title rule (CLAUDE.md §12.4): `[SPEC-NNN] <imperative summary>` for code; `docs(<slug>): ... [skip-tdd]` for docs-only.
-->

## Summary

<!-- 1–3 bullet points on WHY (not WHAT — diff shows what). -->
-

## Spec / AC / ADR references

<!-- CLAUDE.md §12.1 — code without spec is rejected. Mark N/A only if docs-only. -->
- SPEC: `docs/specs/SPEC-NNN-...md` (or N/A — docs-only / hot-fix / build)
- AC: `docs/acceptance/AC-NNN-...md` (or N/A)
- ADR: `docs/adr/ADR-NNN-...md` (or N/A — no architecture decision)

## Anti-pattern self-audit

<!-- See docs/reviews/anti-pattern-checklist.md. Each chain: verify-result OR `N/A — <why>`. -->
<!-- Don't silently skip — silent skip is the same anti-pattern this checklist catches. -->

- **#1 grep-verify before write**:
- **#2 POST-WRITE verify**:
- **#3 cross-page semantic alignment**:
- **#4 NaN guard**:
- **#5 first-call-only ignore**:
- **#6 Resium reference-stability**:
- **#X (process) — visual-bug regression test exists / "untestable because <reason>"**:

## Verification

<!-- Paste actual output snippet, not just "ran". -->
- `./verify.sh`: <result — e.g. "9 blocking + 3 advisory all green">
- `pytest services/<svc>/tests -q`: <count passed / xfailed / failed>
- `npx vitest run`: <count> passed
- `scripts/check-no-secrets.sh`: clean / flagged

## Test plan

<!-- Bulleted checklist. CLAUDE.md §12.2: red→green→refactor — failing test must be in git history before the fix. -->
<!-- For docs-only PRs, "verify.sh green + manual readthrough" is enough; mark `[skip-tdd]` in commit subject. -->
- [ ]
- [ ]

## Anonymity / secrets

<!-- §2.1 (relaxed 2026-05-01): repo content does NOT need anonymity scrubbing. -->
<!-- This block is for the SUBMISSION-ARCHIVE side only; usually N/A. -->
- [ ] N/A — repo-only change (most PRs)
- [ ] OR: submission-archive deliverable — `exiftool -all=` clean, no PII in screenshots
- [ ] `scripts/check-no-secrets.sh` clean (real secrets only — AKID / API keys / PEM)

## Risk + rollback

- Blast radius: <local code | shared infra | live cluster | release artifact>
- Rollback: <git revert | kubectl rollout undo | retag previous>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
