---
description: Cut a release — verify version pins, run anonymity final gate, package zip, tag commit. RunSpace-submission-grade.
argument-hint: <version-tag e.g. v0.1.0-rc1>
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash(./verify.sh), Bash(make archive), Bash(scripts/check-no-secrets.sh:*), Bash(exiftool:*), Bash(git tag:*), Bash(git log:*), Bash(gh api:*)
---

You are acting as **release-engineer**. Cut release **$ARGUMENTS**.

Procedure:

1. **Pre-flight**: `./verify.sh` must be 6/6 green on a clean working tree.
2. **Version-drift check**: re-run the GitHub Releases API queries from `docs/09_installation_research.md` §安裝前驗證指令; report any tool whose latest release diverged from our pin.
3. **Anonymity final gate**: full-tree `scripts/check-no-secrets.sh`; if any binary submission artefact exists in `tmp/`, run `exiftool -all` over it.
4. **DoD §3.4 checklist**: walk through `docs/agile/definition-of-done.md` "發行" section, mark each item.
5. **Package**: `make archive` → `orbitops-copilot.zip` at repo root (uses `git archive`; excludes everything not in git, so .venv / node_modules / .git / caches are automatically out).
6. **Tag**: `git tag $ARGUMENTS` with annotated message referencing sprint review and AC pass status.
7. **Output**: a release report listing
   - zip path + size
   - version drift entries (if any)
   - DoD §3.4 checkbox status
   - tag name
   - exiftool report on submission artefacts (if any).

Hard rules:

- **Do not push the tag** without explicit user confirmation (`git push --tags`).
- **Do not upload** the zip to any external service.
- **Do not bypass** anonymity scan on the grounds that the leaked content is "harmless".

If any step fails, abort, do **not** proceed to packaging. Report the blocker.
