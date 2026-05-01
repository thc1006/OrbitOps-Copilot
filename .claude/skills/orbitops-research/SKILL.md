---
name: orbitops-research
description: Verify and cite TASA / B5G / NTN / 3GPP / Nephio / O-RAN / NVIDIA Aerial / AODT / Sionna RT / RunSpace facts with primary sources. Use when adding any external claim to docs or pitch.
---

## Overview

Authoritative source-cited research workflow. Every fact must carry a primary source URL, publication date, and confidence (High / Medium / Low). Versions never guessed — if uncertain, mark "需安裝前再次確認" with a one-line verification command.

## Triggers

- Any task that adds an external claim to `docs/00_research_2026_04.md`, `docs/06_runspace_pitch_outline.md`, demo scripts, or simulation parameters.
- Any version pin in `docs/09_installation_research.md` or `pyproject.toml` / `package.json`.
- Slash command `/research <topic>`.

## Inputs

- A topic or claim (e.g., "Rel-19 Store-and-Forward freeze date", "Nephio R5 ArgoCD support").
- Existing entries in `docs/00_research_2026_04.md` and `docs/10_links.md` (allowlist).

## Step-by-step workflow

1. **Search primary first**: `tasa.org.tw`, `3gpp.org`, `docs.nephio.org`, `o-ran.org`, `developer.nvidia.com`, GitHub releases pages.
2. **WebFetch** the most authoritative-looking hit for full content; copy quote + URL.
3. **Verify version pins** with `gh api repos/<owner>/<repo>/releases/latest` for each tool.
4. **Compose entry**: 1-sentence claim + URL + date + confidence + 1-line implication for OrbitOps Copilot.
5. **Append** to `docs/00_research_2026_04.md` under correct §; add URL to `docs/10_links.md` if new.
6. **Anonymity scan**: never name teams / schools / individuals; only public organizations / programs / products.
7. **Summary** ≤ 200 words listing what you added.

## Output format

```markdown
| 事實 | 來源 | 日期 | 信心度 | 影響 |
|---|---|---|---|---|
| <one-sentence claim> | [<title>](<URL>) | YYYY-MM-DD | High/Medium/Low | <1-line> |
```

## Verification checklist

- [ ] Every fact has a primary URL (not a Twitter/Medium recap unless cross-confirmed).
- [ ] No unconfirmed version numbers — uncertain ones marked "需安裝前再次確認".
- [ ] No team / school / personal identifiers.
- [ ] `docs/10_links.md` updated if any URL is new.
- [ ] `./verify.sh` clean (anonymity gate).

## Common failure modes

- Citing Wikipedia as primary for a 3GPP spec (use 3gpp.org instead).
- Quoting a vendor blog as a standards claim (cross-check 3GPP docs).
- Inventing a version number when the GitHub releases page would not respond — mark as needs-verify, do **not** guess.
- Letting an LLM-summarized "fact" through without re-reading the source.

## Forbidden actions

- Fabricating dates, version numbers, or organization names.
- Modifying code or services.
- Adding URLs not in `docs/10_links.md` allowlist without first appending them there.
- Editing other agents' specs/ADRs.
