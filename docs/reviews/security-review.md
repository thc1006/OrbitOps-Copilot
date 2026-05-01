# Security Review — OrbitOps Copilot

| Field | Value |
|---|---|
| Reviewer | safety reviewer |
| Branch under review | `chore/repo-review` (off `baseline-sprint-1`) |
| Date | 2026-04-30 |
| Scope | secrets, anonymity, prompt injection, supply chain, MCP, hooks, dependency surface |

## Threat model recap

OrbitOps Copilot is a Sprint-1 demo for an anonymous RunSpace contest entry. The threat surface that matters:

1. **Anonymity leak** — RunSpace requires no team / school / personal identifier. Any leak (in commits, logs, screenshots, video metadata, dependency `package-lock.json`, repo URL) disqualifies. **This is the dominant risk.**
2. **Prompt injection** — Copilot answers questions about NTN telemetry; an attacker who controls log content (e.g., via PR comment text in a future integration) could try to override system behavior.
3. **Supply chain** — Python + npm dependency surface; CesiumJS / FastAPI / fastapi / pydantic etc.
4. **Dangerous hooks / shell rules** — `.claude/settings.json` permission gate; would a misuse delete files / push code / leak data?
5. **Demo machine compromise** — secrets in `.env` files; `make dev-up` leaving Grafana on default password.

Each addressed below.

## Findings

### S-1 (RETIRED 2026-05-01) — Real name in public git history

> **Status: RETIRED.** Project owner reversed the repo-wide anonymity stance on 2026-05-01 (see CLAUDE.md §2.1). Real name in git history is **no longer a defect** at the repo level. The original finding text is preserved below for historical audit context.

~~`蔡秀吉 <84045975+thc1006@users.noreply.github.com>` is the author of `c3c698f Initial commit`, visible at `https://github.com/thc1006/OrbitOps-Copilot/commit/c3c698f`. Public.~~

~~**Threat**: RunSpace evaluator runs `git log` → sees real name → anonymity-rule violation → submission disqualified.~~

**Why retired**: anonymity scope is now narrowed to the actual RunSpace submission archive (CLAUDE.md §7). When that archive is produced via `make archive`, only the *deliverable copy* needs sanitisation (if the contest term requires it). Git history of the source repo is out of scope.

If a future RunSpace contest term reinstates a stricter "anonymous source code" requirement, the playbook below stays usable:

```bash
# Option A — rewrite history with git-filter-repo
pip install git-filter-repo
git filter-repo --mailmap <(echo "OrbitOps Copilot <anon@orbitops.local> 蔡秀吉 <84045975+thc1006@users.noreply.github.com>")
git push --force-with-lease origin --all
git push --force-with-lease origin --tags

# Option B — recreate the repo under an anon account
gh repo create anon-orbitops/orbitops-copilot --public --source=. --push

# Option C — make repo private
gh repo edit thc1006/OrbitOps-Copilot --visibility private --accept-visibility-change-consequences
```

### S-2 (RETIRED 2026-05-01) — Owner GitHub handle in repo URL

> **Status: RETIRED.** Same policy reversal as S-1. GitHub identity in the repo URL is acceptable per CLAUDE.md §2.1.

~~`thc1006/OrbitOps-Copilot` — owner handle is part of the URL. Same anonymity threat as S-1.~~

~~**Mitigation already in baseline**: `verify.sh` gate 6 (`forbidden_pat`) catches `thc1006` if it ever appears in tracked files. Gate is operating; clean today.~~

**Why retired**: gate 6 itself was removed in the same 2026-05-01 change (see PR #31). The git-author advisory gate (1c) was also removed. Current `verify.sh` runs 5 gates (lint / tests / real-secrets / schema / k8s manifest) and does not police identity exposure.

### S-3 (Medium) — Sprint-1 demo creds: Grafana admin/admin

`deploy/docker-compose.yml` ships:
```yaml
GF_SECURITY_ADMIN_USER: admin
GF_SECURITY_ADMIN_PASSWORD: admin
GF_AUTH_ANONYMOUS_ENABLED: "true"
GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer
```

For a **local demo on a developer machine**, this is fine and intentional. For any deployment beyond that (a public host, a shared dev env), it's an open invite. Documented in `docs/demo/observability.md` but worth a hardening note.

**Recommended fix**: add a `deploy/docker-compose.override.example.yml` showing how to override these creds. Defer; not auto-fixed.

### S-4 (High) — `package-lock.json` contains npm registry URLs that match anonymity grep

PR #6 (digital-twin-ui) adds `package-lock.json` (~5000+ lines). Existing `verify.sh` gate 6 already excludes lockfiles via `--exclude=package-lock.json`. **Confirmed clean** in this audit.

But: a contributor adding a different lockfile name (`pnpm-lock.yaml`, `yarn.lock`, future `bun.lockb`) without updating the exclude list could re-trigger false positives.

**Auto-applied this PR**: pre-existing (lines 73-82 of verify.sh already include `--exclude=package-lock.json --exclude=pnpm-lock.yaml --exclude=yarn.lock`). No new fix needed; confirmed and documented.

### S-5 (Low) — MCP install plan documents tokens in `${VAR}` form

`docs/mcp/03_mcp_install_plan.md` instructs: never commit raw tokens; use `${GITHUB_TOKEN}` env-var substitution. `.env.example` has commented placeholders. Pattern is sound. No findings.

### S-6 (Low) — `.claude/settings.json` permissions surface

Audit:
- `allow`: 30+ Bash patterns, all read-only or build/test (`ls`, `cat`, `git status/diff/log`, `make`, `pytest`, `kustomize build`, `kubectl apply --dry-run=client`).
- `ask`: write actions that need explicit user confirm (`git push`, `git tag`, `npm install`, `docker build`, `kubectl apply`, `kind create/delete`).
- `deny`: `rm:*`, `curl:*`, `wget:*`, `git push --force:*`, `git push -f:*`, `git commit --no-verify:*`, `git config:*`, `sudo:*`, `chmod 777:*`, `WebFetch(domain:*.cn)`, `WebFetch(domain:pastebin.com)`.

No hooks defined (zero entries in `hooks` arrays).

This is a defensible posture. One refinement worth noting: `Bash(curl:*)` is denied — but `curl` is occasionally needed legitimately (e.g., `scripts/check-observability.sh` does not use curl, but `scripts/demo-beam-quality.sh` does). Verified: that script is invoked as `scripts/demo-beam-quality.sh` (in `allow`), and within it curl runs as a child process, not as a top-level Bash tool call — so the allow-list works at the entry point.

No fix needed.

### S-7 (Low) — LLM prompt-injection defence

Strong. Provider abstraction (`_provider.py::FakeLLMProvider`) **does not consume log line text** for decision logic; it only inspects `evidence.metrics_used` shape. Therefore log-content injection (`"IGNORE PREVIOUS INSTRUCTIONS"`) cannot redirect the answer. Test `test_prompt_injection_in_logs_does_not_override_system_behavior` verifies. AC-003.3 covers this normatively.

When `OpenAICompatibleProvider` lands in Sprint 2, this property must be re-verified — system prompt template MUST quote-fence log lines as untrusted data, not interpolate them. Note added to `nephio-o2ims-integration.md` analog → suggest adding similar guard to SPEC-003 §Sprint-2 hand-off.

### S-8 (Low) — Dependency surface

Python: fastapi, uvicorn, pydantic, jsonschema, prometheus-client, httpx, pytest, ruff. All mainstream, recently-maintained.
npm (PR #6): react, react-dom, vite, vitest, tailwindcss, @testing-library, jsdom. All mainstream.

No supply-chain surprise. `pip-audit` / `npm audit` in CI would be a Sprint 2 hardening.

## Auto-applied this PR

**Anonymity author-allowlist advisory in `verify.sh`** (gate 1c): scan `git log --all --format='%ae'` for unique author emails; warn (do not fail) on any address not matching `*@orbitops.local`. Pure additive; on baseline + this branch, prints one WARN line per non-anon author so the operator sees the residual risk on every `make verify`.

**Fix-up applied during self-review (R-3)**: initial draft of gate 1c also allowlisted `*@users.noreply.github.com` — this was unsafe because GitHub's noreply form is `<id>+<handle>@users.noreply.github.com` (handle leaks). The fix narrows the allowlist to **only** `<*>@orbitops.local`. The leaked initial-commit author is now correctly caught.

The WARN line emits only the domain (`users.noreply.github.com`), not the full email — so the warning itself does not introduce a forbidden string into CI logs.

## Self-review (R-1 / R-2 / R-3) found during /review pass

- **R-1**: `check-tdd-discipline.sh` regex `^red[\(:[:space:]]` was malformed (POSIX `[:space:]` only works inside `[[:space:]]`). Fixed to `^red[[:space:]:(]`.
- **R-2**: `((red_count++)) || true` is brittle under `set -euo pipefail`. Replaced with `red_count=$((red_count + 1))`.
- **R-3**: gate 1c initially allowlisted `noreply.github.com` — false reassurance. Tightened to `*@orbitops.local` only.

All three fixes verified by re-running `make verify`: TDD gate now fires on its own branch (1 commit, 0 red); author gate now warns on the actual leak.

## Outstanding (open, owner-only)

- S-1 / S-2: history rewrite OR repo private OR account move. Coordinate with RunSpace submission timeline.
