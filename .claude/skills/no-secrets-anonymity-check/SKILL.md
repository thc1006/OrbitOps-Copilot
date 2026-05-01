---
name: no-secrets-anonymity-check
description: Run + interpret + extend the real-secrets scan. Pre-commit, pre-PR, pre-release gate. (Folder name retains "anonymity" for backwards-link compat; the anonymity-scan was retired 2026-05-01 — see CLAUDE.md §2.1.)
---

## Overview

Wraps `scripts/check-no-secrets.sh`. Catches **credential leaks**: AWS access key IDs, OpenAI / Anthropic API keys, GitHub tokens, PEM private-key headers. Fail-fast: any hit blocks commit / PR / release.

Earlier versions also scanned for school names / school e-mails / personal handles / gmail to enforce repo-wide RunSpace anonymity. That stance was relaxed on 2026-05-01: the repo now allows real names; only the actual RunSpace submission archive needs metadata cleanup, and that's a packaging-time concern (see `make archive` + CLAUDE.md §7).

## Triggers

- Pre-commit hook (auto via `.claude/settings.json` PreToolUse on Write/Edit).
- Pre-PR (CI job `no-secrets`).
- Before producing the RunSpace deliverable archive (`make archive`).
- After any update to forbidden patterns or allowlists.
- Slash command `/review` includes this skill.

## Inputs

- The current working tree (or staged files when invoked with `--staged`).
- `scripts/check-no-secrets.sh` rule set.

## Step-by-step workflow

1. Run `scripts/check-no-secrets.sh` (full scan) or `scripts/check-no-secrets.sh --staged` (pre-commit).
2. If no hits → `clean.` exit 0.
3. If hits:
   - Inspect each: is it a true positive, false positive, or test fixture?
   - True positive → remove the offending content; re-scan.
   - False positive (e.g., school acronym appearing in a 3GPP TS document number) → tighten the regex in `scripts/check-no-secrets.sh` to exclude that specific context, justify in commit message.
   - Test fixture (e.g., a sample API key for parser test) → must be rejected; use synthetic placeholder like `sk-test-NOTAREALKEY`.
4. Re-run until clean.
5. For final release scan, additionally run `exiftool -all` over any binary artefacts (PDF, MP4, PNG) to be submitted.

## Output format

- Exit code 0 (clean) or 1 (hits).
- On hits, structured list:
  ```
  [<label>]  <file path>
  ```

## Verification checklist

- [ ] Exit 0 from `scripts/check-no-secrets.sh`.
- [ ] All 9 pattern categories invoked (AKID, OpenAI, Anthropic, GH token, private key, school, school-email, personal, gmail).
- [ ] `git log --format='%ae' -20` reviewed: no school / personal e-mails. Use anon e-mail (`anon@orbitops.local`) or GitHub `<id>+<user>@users.noreply.github.com`.
- [ ] Final-release: `exiftool -all=` run on every PDF / MP4 / PNG submission artefact.

## Common failure modes

- A team chat handle slipped into a CHANGELOG.
- Real e-mail in a `Co-authored-by:` git trailer.
- A school name embedded in a sample dataset JSON.
- An API key copy-pasted into a test fixture instead of using `os.environ` placeholder.
- exiftool not run → submitted MP4 has Producer / Author = real name.

## Forbidden actions

- Adding a `noqa` comment to bypass the scan.
- Editing `scripts/check-no-secrets.sh` to **remove** a pattern (only tightening is allowed; removal needs ADR).
- Committing a `.secrets-baseline.txt` file.
- Force-pushing to overwrite a leaked-credential commit (rotate the credential AND remove via `git filter-repo`; coordinate with security-reviewer).
