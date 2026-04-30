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

### S-1 (Critical) — Real name in public git history (Q-1 dup; security view)

`<real-name-redacted> <<noreply-email-redacted>>` is the author of `c3c698f Initial commit`, visible at `https://github.com/<OWNER>/<REPO>/commit/c3c698f`. Public.

**Threat**: RunSpace evaluator runs `git log` → sees real name → anonymity-rule violation → submission disqualified.

**Remediation playbook** (do not auto-execute; documented for user-driven fix):

```bash
# Option A — rewrite history with git-filter-repo (recommended)
pip install git-filter-repo
git filter-repo --mailmap <(echo "OrbitOps Copilot <anon@orbitops.local> <real-name-redacted> <<noreply-email-redacted>>")

# Force-push to all branches on origin (DESTRUCTIVE; coordinate first):
git push --force-with-lease origin --all
git push --force-with-lease origin --tags

# Option B — recreate the repo
gh repo create anon-orbitops/orbitops-copilot --public --source=. --push
# Then archive <OWNER>/<REPO> OR make it private.

# Option C — make current repo private (lowest cost; doesn't fix history but hides it from public eyes)
gh repo edit <OWNER>/<REPO> --visibility private --accept-visibility-change-consequences
```

**Status**: open. Auto-fix not applied. Owner-only decision.

### S-2 (High) — Owner GitHub handle in repo URL

`<OWNER>/<REPO>` — owner handle is part of the URL. Same anonymity threat as S-1.

**Mitigation already in baseline**: `verify.sh` gate 6 (`forbidden_pat`) catches `<OWNER>` if it ever appears in tracked files. Gate is operating; clean today.

**Outstanding gap**: gate does NOT scan git author/committer fields. Adding that is the auto-applied fix (see §Auto-applied below).

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

**Anonymity author-allowlist advisory in `verify.sh`**: scan `git log --all --format='%ae'` for unique author emails; warn (do not fail) on any address not matching `*@orbitops.local`. Pure additive; on baseline + this branch, will print one WARN line for the existing leaked initial commit so the operator sees the residual risk on every `make verify`. Guides them to fix S-1 / S-2 explicitly.

## Outstanding (open, owner-only)

- S-1 / S-2: history rewrite OR repo private OR account move. Coordinate with RunSpace submission timeline.
