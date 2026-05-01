#!/usr/bin/env bash
# check-no-secrets.sh — block real credential leaks.
#
# Run by: pre-commit hook + CI + verify.sh.
# Non-destructive — only reports + exits non-zero.
#
# Scope (post-2026-05-01 anonymity-relaxation): real secrets ONLY.
#   - AWS access key IDs                      (AKIA…)
#   - OpenAI API keys                         (sk-…)
#   - Anthropic API keys                      (sk-ant-…)
#   - GitHub tokens                           (ghp_/ghs_/…)
#   - Private-key headers                     (-----BEGIN …PRIVATE KEY-----)
#
# Earlier versions also scanned for school names / school e-mails / personal
# Gmail / personal handles to enforce RunSpace anonymity. The project owner
# relaxed that on 2026-05-01 (real name OK in repo); only the actual RunSpace
# submission archive (zip / pdf / mp4) needs metadata cleanup, and that's
# done at packaging time per CLAUDE.md §7 — not by this scanner.
#
# A self-test fires when invoked with `--self-test` so make verify can prove
# the gate actually detects real secrets.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ANSI
R=$'\e[31m'; Y=$'\e[33m'; G=$'\e[32m'; X=$'\e[0m'

# ── Self-test ───────────────────────────────────────────
# Plant ONE canary per pattern category, run the scan against /tmp, and
# require ALL of them to fire. Each real-secret category gets its own file
# so a future silent regression on (say) the Anthropic pattern is caught
# precisely, not masked by a co-firing AWS canary.
if [ "${1:-}" = "--self-test" ]; then
  td="$(mktemp -d)"
  trap 'rm -rf "$td"' EXIT

  declare -A canaries=(
    ["aws.md"]="canary: AKIAABCDEFGHIJKLMNOP"
    ["openai.md"]="canary: sk-abc123def456ghi789jkl012mno345pqr678st"
    ["anthropic.md"]="canary: sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEF12"
    ["github-token.md"]="canary: ghp_abcdefghijklmnopqrstuvwxyz123456"
    ["private-key.md"]="canary: -----BEGIN RSA PRIVATE KEY-----"
  )

  failed=()
  for fname in "${!canaries[@]}"; do
    printf '%s\n' "${canaries[$fname]}" > "$td/$fname"
  done

  # Run the scan ONCE; expect every canary file to be reported.
  scan_output="$("$0" --root "$td" 2>&1 || true)"
  for fname in "${!canaries[@]}"; do
    if ! printf '%s' "$scan_output" | grep -q "$fname"; then
      failed+=("$fname (${canaries[$fname]})")
    fi
    # Tear down before next iteration; preserves isolation if you add stateful checks later.
  done

  if [ "${#failed[@]}" -gt 0 ]; then
    printf "${R}check-no-secrets self-test FAILED: these categories did not fire:${X}\n"
    for f in "${failed[@]}"; do
      printf "  - %s\n" "$f"
    done
    exit 1
  fi
  printf "${G}check-no-secrets self-test ok: all %d categories fired${X}\n" "${#canaries[@]}"
  exit 0
fi

# ── Patterns to detect (real secrets only) ────────────
# AWS access keys
PAT_AWS_AKID='AKIA[0-9A-Z]{16}'
# Generic API keys (40+ chars high-entropy)
PAT_OPENAI='sk-[A-Za-z0-9]{32,}'
PAT_ANTHROPIC='sk-ant-[A-Za-z0-9-]{30,}'
PAT_GH_TOKEN='gh[pousr]_[A-Za-z0-9]{30,}'
# Private key headers
PAT_PRIV_KEY='-----BEGIN [A-Z ]*PRIVATE KEY-----'

PATTERNS=(
  "$PAT_AWS_AKID"
  "$PAT_OPENAI"
  "$PAT_ANTHROPIC"
  "$PAT_GH_TOKEN"
  "$PAT_PRIV_KEY"
)
LABELS=(
  "AWS access key"
  "OpenAI API key"
  "Anthropic API key"
  "GitHub token"
  "Private key header"
)

# ── Scan target (default = repo root; --root <dir> overrides for self-test) ──
SCAN_ROOT="."
if [ "${1:-}" = "--root" ] && [ -n "${2:-}" ]; then
  SCAN_ROOT="$2"
  shift 2
fi

# ── Build a single grep call per pattern (A fix) ───────
# Use grep's own --exclude-dir + --include flags. No find indirection.
COMMON_GREP_FLAGS=(
  -RIEln
  --binary-files=without-match
  --include='*.md'    --include='*.txt'   --include='*.json'
  --include='*.yaml'  --include='*.yml'   --include='*.toml'
  --include='*.py'    --include='*.ts'    --include='*.tsx'
  --include='*.js'    --include='*.jsx'   --include='*.sh'
  --include='*.dockerfile' --include='Dockerfile'
  --include='*.cfg'   --include='*.ini'
  --exclude='package-lock.json' --exclude='pnpm-lock.yaml' --exclude='yarn.lock'
  --exclude-dir='.git' --exclude-dir='node_modules'
  --exclude-dir='.venv' --exclude-dir='venv'
  --exclude-dir='dist' --exclude-dir='build' --exclude-dir='tmp'
  --exclude-dir='__pycache__' --exclude-dir='.pytest_cache' --exclude-dir='.ruff_cache'
)

hits=()
for i in "${!PATTERNS[@]}"; do
  pat="${PATTERNS[$i]}"
  label="${LABELS[$i]}"
  # Capture file paths matching this pattern.
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    # Skip self & verify.sh: they legitimately mention forbidden patterns
    # while describing them. (docs/reviews + docs/adr exemptions removed
    # along with the anonymity patterns they were carved out for.)
    case "$line" in
      *scripts/check-no-secrets.sh*) continue ;;
      *verify.sh*) continue ;;
    esac
    hits+=( "$label	$line" )
    # Use --regexp=PATTERN so patterns that begin with `-` (e.g. PEM
    # `-----BEGIN PRIVATE KEY-----`) aren't reparsed as options by some
    # grep implementations (notably ugrep, which is a /usr/bin/grep on
    # certain Linux distros).
  done < <(grep "${COMMON_GREP_FLAGS[@]}" --regexp="$pat" "$SCAN_ROOT" 2>/dev/null || true)
done

# Pre-commit can pass --staged to scan only staged files
if [ "${1:-}" = "--staged" ]; then
  staged="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)"
  if [ -n "$staged" ]; then
    filtered=()
    for h in "${hits[@]:-}"; do
      [ -z "$h" ] && continue
      f="${h#*	}"
      if echo "$staged" | grep -qxF "${f#./}"; then
        filtered+=( "$h" )
      fi
    done
    hits=( "${filtered[@]:-}" )
  fi
fi

if [ "${#hits[@]}" -gt 0 ] && [ -n "${hits[0]:-}" ]; then
  printf "${R}check-no-secrets: leak(s) detected${X}\n"
  for h in "${hits[@]}"; do
    [ -z "$h" ] && continue
    label="${h%%	*}"
    file="${h#*	}"
    printf "  ${Y}[%s]${X} %s\n" "$label" "$file"
  done
  printf "${R}aborting commit / verify.${X} If false positive, refine patterns in scripts/check-no-secrets.sh.\n"
  exit 1
fi

printf "${G}check-no-secrets: clean.${X}\n"
exit 0
