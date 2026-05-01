# `.claude/hooks/` — Claude Code hook scripts

Hooks fire around Claude Code's tool calls. Each script:
- reads tool input as JSON via stdin (NOT via `$CLAUDE_TOOL_INPUT` env var),
- exits `0` to allow / `2` to hard-block (PreToolUse only) / always `0` for advisory.

Per CLAUDE.md §6: hooks ONLY do lint / format / test / secrets-scan /
advisory reminders / blocking gate. They do NOT auto-delete, auto-push,
or auto-upload anything.

## Wiring

Registered in `.claude/settings.json` `hooks:` block. Matchers:

| Hook script | Event | Matcher | Timeout |
|---|---|---|---|
| `block-env-write.sh` | PreToolUse | `Write\|Edit\|MultiEdit` | 5s |
| `protect-critical-paths.sh` | PreToolUse | `Bash` | 5s |
| `pre-commit-checks.sh` | PreToolUse | `Bash` | 90s |
| `format-on-edit.sh` | PostToolUse | `Write\|Edit\|MultiEdit` | 10s |
| `remind-verify.sh` | Stop | — | 5s |

## What each hook does

### `block-env-write.sh` (PreToolUse, blocking)
Refuses any `Write`/`Edit`/`MultiEdit` whose `file_path` is `.env`,
`.env.local`, `.env.production`, `.env.staging`, `.env.development`,
`.env.test`, or any other `.env.*` that isn't `.env.example`. Writing
secrets via Claude is forbidden by CLAUDE.md §6.

### `protect-critical-paths.sh` (PreToolUse, blocking)
Refuses `rm` / `git rm` commands that touch
`docs/specs/`, `docs/adr/`, `docs/acceptance/`, `tests/contracts/`,
`CLAUDE.md`, or `AGENTS.md`. These are the project's contracts; their
retirement requires a deliberate ADR + a rm performed outside Claude Code.

### `pre-commit-checks.sh` (PreToolUse, blocking, fires only on `git commit`)
Three sequential gates:
1. **Staged secrets**: blocks if `.env` / `.env.local` / etc. is staged.
2. **`scripts/check-no-secrets.sh --staged`**: full anonymity / AKID /
   key-header scan over staged files.
3. **Quick service tests**: for each `services/<svc>/{src,tests}/*.py`
   change, runs `pytest services/<svc>/tests`. Fails fast on first error.

### `format-on-edit.sh` (PostToolUse, advisory)
After a `Write`/`Edit`/`MultiEdit` on a `*.py` file, runs
`ruff format` + `ruff check --fix-only`. Silent if ruff isn't installed.
Cannot block (the tool already ran).

### `remind-verify.sh` (Stop, advisory)
At end of every Claude turn, if the working tree has uncommitted source
changes (`*.py *.ts *.tsx *.sh *.yml *.yaml *.json *.toml`), prints a
nudge to run `./verify.sh` before pushing. Idempotent; uses
`git status --porcelain`, no inter-hook state.

## Testing a hook locally

Each hook is a standalone bash script. Test with synthetic stdin:

```bash
# Should exit 2 (block):
echo '{"tool_input":{"file_path":".env"}}' | .claude/hooks/block-env-write.sh
echo $?

# Should exit 0 (allow):
echo '{"tool_input":{"file_path":".env.example"}}' | .claude/hooks/block-env-write.sh
echo $?

# Word-boundary regression — words containing "rm" must NOT trigger:
echo '{"tool_input":{"command":"harm myself"}}' | .claude/hooks/protect-critical-paths.sh ; echo $?  # 0
echo '{"tool_input":{"command":"term docs/specs/foo"}}' | .claude/hooks/protect-critical-paths.sh ; echo $?  # 0
echo '{"tool_input":{"command":"rm docs/specs/foo"}}' | .claude/hooks/protect-critical-paths.sh ; echo $?  # 2
```

## Adding a new hook

1. Write `.claude/hooks/<name>.sh`. Reuse the existing structure
   (header comment, `set -euo pipefail`, jq for JSON parsing, exit codes).
2. `chmod +x .claude/hooks/<name>.sh`.
3. Wire it into `.claude/settings.json` under the appropriate event.
4. Add a row to the table above.
5. Add a functional test (see "Testing a hook locally").
6. Land via PR. The `verify` job will catch any settings.json typos via
   the JSON parse step.

## Known constraint

`jq` is required (used to parse the stdin JSON payload). Standard on
Linux / macOS dev boxes; document in `make bootstrap` if it's ever
missing on a contributor's machine.
