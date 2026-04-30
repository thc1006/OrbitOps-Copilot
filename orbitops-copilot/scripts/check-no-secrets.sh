#!/usr/bin/env bash
# check-no-secrets.sh — block obvious credential / anonymity leaks.
#
# Run by: pre-commit hook + CI + verify.sh.
# Non-destructive — only reports + exits non-zero.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ANSI
R="\033[31m"; Y="\033[33m"; G="\033[32m"; X="\033[0m"

# ── Patterns to detect ─────────────────────────────────
# AWS access keys
PAT_AWS_AKID='AKIA[0-9A-Z]{16}'
# Generic API keys (40+ chars high-entropy)
PAT_OPENAI='sk-[A-Za-z0-9]{32,}'
PAT_ANTHROPIC='sk-ant-[A-Za-z0-9-]{30,}'
PAT_GH_TOKEN='gh[pousr]_[A-Za-z0-9]{30,}'
# Private key headers
PAT_PRIV_KEY='-----BEGIN [A-Z ]*PRIVATE KEY-----'
# Anonymity leaks (school / personal identifiers)
PAT_SCHOOL='\b(NCTU|NYCU|NTU|NCKU|NTHU|NTUST|NCU|NTUT|NSYSU|NCHU)\b'
PAT_EMAIL_AT_SCHOOL='@[a-z]+\.(nctu|nycu|ntu|ncku|nthu|ntust)\.edu\.tw'
# GitHub handle `thc1006` allowed per CLAUDE.md §7; still flag school-email
# local-part variants because those connect back to a school address.
PAT_PERSONAL='(hctsai1006|hctsai)'
# Common dev e-mails
PAT_EMAIL_GMAIL='[a-zA-Z0-9._%+-]+@gmail\.com'

PATTERNS=(
  "$PAT_AWS_AKID"
  "$PAT_OPENAI"
  "$PAT_ANTHROPIC"
  "$PAT_GH_TOKEN"
  "$PAT_PRIV_KEY"
  "$PAT_SCHOOL"
  "$PAT_EMAIL_AT_SCHOOL"
  "$PAT_PERSONAL"
  "$PAT_EMAIL_GMAIL"
)
LABELS=(
  "AWS access key"
  "OpenAI API key"
  "Anthropic API key"
  "GitHub token"
  "Private key header"
  "School name (anonymity violation)"
  "School e-mail (anonymity violation)"
  "Personal handle (anonymity violation)"
  "Personal e-mail (gmail)"
)

# Files to scan: tracked source + this scan respects .gitignore
SCAN_GLOBS=(
  "*.md" "*.txt" "*.json" "*.yaml" "*.yml" "*.toml"
  "*.py" "*.ts" "*.tsx" "*.js" "*.jsx" "*.sh"
  "*.dockerfile" "Dockerfile"
)

EXCLUDE_DIRS=( ".git" "node_modules" ".venv" "venv" "dist" "build" ".pytest_cache" ".ruff_cache" "__pycache__" )

# Build find expression
find_args=( . -type f )
for d in "${EXCLUDE_DIRS[@]}"; do
  find_args+=( -not -path "*/$d/*" )
done

# Emit list of matched files
hits=()
for i in "${!PATTERNS[@]}"; do
  pat="${PATTERNS[$i]}"
  label="${LABELS[$i]}"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    # Skip self & docs/00 + docs/05 + check-no-secrets.sh + verify.sh which legitimately mention school names as forbidden patterns
    case "$line" in
      *scripts/check-no-secrets.sh*) continue ;;
      *verify.sh*) continue ;;
    esac
    hits+=( "$label	$line" )
  done < <(grep -RIEln --binary-files=without-match "$pat" "${find_args[@]}" 2>/dev/null || true)
done

# Pre-commit can pass --staged to scan only staged files
if [ "${1:-}" = "--staged" ]; then
  staged="$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)"
  if [ -n "$staged" ]; then
    filtered=()
    for h in "${hits[@]}"; do
      f="${h#*	}"
      if echo "$staged" | grep -qxF "${f#./}"; then
        filtered+=( "$h" )
      fi
    done
    hits=( "${filtered[@]}" )
  fi
fi

if [ "${#hits[@]}" -gt 0 ]; then
  printf "${R}check-no-secrets: leak(s) detected${X}\n"
  for h in "${hits[@]}"; do
    label="${h%%	*}"
    file="${h#*	}"
    printf "  ${Y}[%s]${X} %s\n" "$label" "$file"
  done
  printf "${R}aborting commit / verify.${X} If false positive, refine patterns in scripts/check-no-secrets.sh.\n"
  exit 1
fi

printf "${G}check-no-secrets: clean.${X}\n"
exit 0
