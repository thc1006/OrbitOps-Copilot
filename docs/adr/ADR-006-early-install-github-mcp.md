# ADR-006 — Early install of github/github-mcp-server in Sprint 0

| 欄位 | 值 |
|---|---|
| Status | Proposed |
| Date | 2026-04-30 |
| Deciders | architect (drafter), security-reviewer (must concur), Product Owner (must approve) |
| Supersedes | n/a |
| Related | `docs/mcp/04_mcp_decision_record.md`, `docs/mcp/03_mcp_install_plan.md` §P1.1, `docs/mcp/02_mcp_security_review.md` §11, ADR-005 |

## Context

`docs/mcp/04_mcp_decision_record.md` §Decision-1 explicitly states **「Sprint 0 不安裝任何 MCP server。Must install now 清單為空」**. The trigger for `github/github-mcp-server` (P1.1) is documented as **「Sprint 1 第 1 個 PR 開出時」** in `docs/mcp/03_mcp_install_plan.md` §流程, and `docs/agile/backlog.md` confirms Sprint 1 has not begun (S1-01..S1-10 are all `[ ]`).

The override path is also documented (`04_mcp_decision_record.md` §Install events log): early install requires (a) an explicit override ADR, (b) named P1 candidate with rationale, (c) confirmed fine-grained PAT, (d) execution of §P1.x. This ADR is the (a) artefact.

**Why is early install being considered now?** The plausible motivations are:

1. Sprint 1 backlog (`backlog.md` S1-01..S1-10) implies the **first PR will open within days** of Sprint 1 kick-off. Pre-provisioning the MCP avoids a context-switch when that PR lands.
2. `/review` slash command and `claims-audit` skill (CLAUDE.md §13.1) reference structured PR-diff inspection that is currently fulfilled only by `Bash(gh api …)` — which works but produces unstructured text the LLM must re-parse each turn.
3. Sprint 0 still has open uncommitted work (`CLAUDE.md` modified, `README.md` deletion staged). Doing the install while the maintainer is already in MCP-context is cheaper than re-loading context next sprint.

**What has not changed since the original decision?**

- Threat surface (`02_mcp_security_review.md` §11): the OX Security stdio-RCE disclosure (2026-04-16) and the Cyata `mcp-server-git` 3-CVE batch (2026-01-20) remain the most recent material events. No new mitigations have been published upstream.
- Anonymity rule (CLAUDE.md §2, §7) still applies; the PAT must be issued from an anonymized GitHub identity (noreply or `anon@orbitops.local`).
- `CLAUDE.md` §14.1 row for `github/github-mcp-server` says **「Sprint 1 首 PR 出現後」OK；「Sprint 0」禁止**. This ADR proposes editing that constraint, not bypassing it silently.

## Decision (proposed)

**Defer.** Reject the early-install request for Sprint 0; revisit on the day the first feature PR is opened.

Rationale:

1. **No real PR exists yet.** §P1.1 testing step requires `prompt：「Show me the diff of PR #1」` — there is no PR #1 to point at. The MCP would idle, which is the worst-of-both-worlds (attack surface present, no exercise).
2. **The benefit being purchased is small.** `/review` and `claims-audit` work today against `Bash(gh api repos/.../pulls/<n>)` allowed by `.claude/settings.json`. The marginal upgrade (structured tool result vs. JSON text the LLM parses) does not justify pulling forward a P1 install by 1 sprint.
3. **The cost being paid is real.** Adding `.mcp.json` + Docker image pull + fine-grained PAT issuance + 30-day rotation calendar item — all to sit idle until S1-01 completes. The §P1.1 PAT scope (`Contents R / Pull requests R / Metadata R / Issues R`) cannot be exercised against a repo with zero PRs and zero issues.
4. **Re-evaluation is cheap.** §P1.1 is fully scripted (install commands, `<PIN>` resolution, `permissions.allow` allowlist, removal). When the first PR opens, this ADR can be re-opened, status flipped, and install run in <30 minutes with two-person review.

If the deciders conclude the small ergonomic win does outweigh the wait, this ADR can be flipped to **Conditional Accept** under the conditions in §"Conditions for promotion to Accepted" below.

## Consequences

Positive (of Defer):

- Zero change to attack surface during Sprint 0; `verify.sh` continues to pass on a `.mcp.json`-free tree.
- Avoids creating a stale PAT (30-day clock starts on issuance, not on first use; an early-issued token wastes ~7 days of validity).
- Preserves the "ADR before each MCP" audit trail intact — no precedent of pre-emptive installs.
- Anonymity surface unchanged; no new identity-bearing artefact (PAT name, token-issued-by) enters the developer's environment.

Negative (of Defer):

- Sprint 1 first-PR moment incurs a ~30-min context-switch (read §P1.1, issue PAT, edit `.mcp.json`, commit, two-person review). Acceptable.
- `/review` and `claims-audit` continue to read PR diffs via unstructured `gh api` output until that moment. Acceptable — these commands have no Sprint 0 invocations on the backlog.

## Alternatives considered

1. **Accept (install now, Sprint 0).** Rejected: §P1.1 explicitly conditions install on "first PR exists"; installing earlier means the smoke test (`Show me the diff of PR #1`) cannot be executed, leaving the install unverified.
2. **Conditional Accept (install only after S1-01 lands and the first PR is opened, but skip writing a separate ADR at that moment).** Rejected: this collapses two ADRs into one and removes the per-install audit gate the original decision document mandates (`04_mcp_decision_record.md` §Decision-2: 「每項先寫 ADR」). The override path expects a fresh ADR per install; that discipline should not be diluted on the first install.
3. **Accept with `--read-only` and empty token (dummy install, exercise wiring only).** Rejected: a tokenless `github-mcp-server` cannot complete authentication; the resulting failure modes (`401` loops in stdio) waste session budget without producing real validation.
4. **Defer (recommended).** Selected. See §Decision.

## Risks specific to early install

These are the risks if the Product Owner overrides this ADR and instructs early install:

- **CVE exposure window extension.** `02_mcp_security_review.md` §11 logs `mcp-server-git` 3 CVEs (2026-01-20), `Filesystem` EscapeRoute (CVE-2025-53109/53110), and OX Security stdio-RCE (2026-04-16). `github-mcp-server` is **not on that CVE list as of 2026-04-30**, but the upstream advisory cadence for MCP servers has been ~1 disclosure/month. Earlier install = longer exposure to whatever drops next.
- **Idle-PAT risk.** A PAT issued in Sprint 0 and unused until Sprint 1 sits in keyring/1Password unexercised; if the developer machine is compromised, the token leaks before the first legitimate audit trail line is written. Mitigation: issue PAT only on first use, not on `.mcp.json` creation.
- **`.mcp.json` becomes the attractor.** Once the file exists with one entry, contributor pressure to add more (context7, kubernetes, grafana) ahead of their gates rises. The empty-file state is itself a defence.
- **Smoke-test gap.** §P1.1 testing requires `Show me the diff of PR #1`. With no PR #1, the install ships unverified. If `--read-only` enforcement breaks (upstream regression), it is undetected until Sprint 1.

What changes between Sprint 0 and Sprint 1 in security posture: **nothing intrinsic to the MCP server itself** — but the *exercise opportunity* changes. Sprint 1 first PR provides a real diff to test against, real `permissions.allow / deny` enforcement to verify, and real two-person review on the `.mcp.json` PR.

## Conditions for promotion to "Accepted"

This ADR moves from `Proposed` → `Accepted` only when **all** of the following are true:

1. **A real PR exists in the orbitops-copilot fork** (PR number ≥ 1, not a draft scaffolding PR — must contain at least one SPEC-NNN code change).
2. **Fine-grained PAT is provisioned** per §P1.1: scoped to the orbitops-copilot fork only, permissions limited to `Contents R / Pull requests R / Metadata R / Issues R`, expiration ≤ 30 days, rotation calendar entry created.
3. **`security-reviewer` agent signs off** on the PAT scope, the `<PIN>` resolved from `gh release view --repo github/github-mcp-server`, and the `permissions.allow` allowlist (no wildcards).
4. **Two-person PR review** of the `.mcp.json` + `.claude/settings.json` diff, per `docs/mcp/03_mcp_install_plan.md` §通用前置.
5. **`scripts/check-no-secrets.sh` passes** against the working tree post-install (PAT must not appear; `gh[pousr]_[A-Za-z0-9]{30,}` pattern guard active).
6. **Smoke test recorded**: `Show me the diff of PR #<n>` succeeds; `Comment on PR #<n>` is denied (read-only enforcement verified).
7. **CLAUDE.md §14.1 row updated** in the same PR to reflect the new effective gate ("Sprint 0 with override ADR-006" replaces "Sprint 1 首 PR 出現後").
8. **Install events log appended** in `04_mcp_decision_record.md` with date, sprint, event, result, and pointer to this ADR.

## Rollback

Per `docs/mcp/03_mcp_install_plan.md` §P1.1「移除方式」:

```bash
claude mcp remove github
claude mcp reset-project-choices
# Edit .mcp.json: remove the "github" entry (or delete the file if it was the only one).
# Commit the diff with message: [mcp] remove github (rollback ADR-006).
# Revoke the PAT at https://github.com/settings/personal-access-tokens.
# Append to docs/mcp/04_mcp_decision_record.md §Install events log: rollback row.
```

If rollback is triggered by a CVE disclosure, also follow `02_mcp_security_review.md` §10 logging — note the CVE ID, disclosure date, and which `<PIN>` was in use at rollback time.
