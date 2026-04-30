---
name: runspace-pitch
description: Build / refine RunSpace 10-page deck, 90-second video, 3-minute English-subtitled video. Anonymity-enforced.
---

## Overview

Translates technical artefacts into RunSpace-ready pitch material. All output is treated as public submission; absolute no-PII. Aligns to two scoring frames: 30/30/30/10 and 35/25/20/20 (`docs/00_research_2026_04.md` §5).

## Triggers

- Editing `docs/06_runspace_pitch_outline.md`, `docs/07_demo_script_90s.md`, `docs/08_demo_script_3min.md`.
- Producing a slide deck (PDF) or video for submission.
- Slash command `/research` produces a new fact that should be reflected on a slide.

## Inputs

- `docs/01_product_strategy.md` (UC1/UC2 + demo story).
- `docs/00_research_2026_04.md` (sources + standards anchoring).
- `docs/03_breakthrough_directions.md` (roadmap).
- `docs/10_links.md` (allowlisted footnote URLs).

## Step-by-step workflow

1. Open the matching outline / script doc.
2. Pull narrative beats from `docs/01_product_strategy.md`.
3. Anchor every external claim to a footnote citing a `docs/10_links.md` URL.
4. Cross-check against `docs/00_research_2026_04.md` confidence column — mark Medium/Low claims with hedge language.
5. Draft slide / scene; render in dry-run.
6. **Anonymity sweep**: `scripts/check-no-secrets.sh` over generated material.
7. (For final video / PDF) `exiftool -all= <file>` to strip metadata.
8. Run `claims-audit` skill against the new pitch text — every claim must classify cleanly.

## Output format

- Updated outline / script .md.
- Optional `tmp/runspace-deck.pdf` and `tmp/runspace-90s.mp4` (gitignored, but submitted externally).

## Verification checklist

- [ ] No team / school / personal identifiers in text, slides, video, or rendered metadata.
- [ ] Every external claim has a footnote URL from `docs/10_links.md`.
- [ ] Two-frame self-score updated if scoring narrative shifts.
- [ ] `./verify.sh` clean (anonymity gate).
- [ ] Video metadata stripped via `exiftool -all=`.
- [ ] OS toolbar / browser tabs not visible in any screenshot.
- [ ] `claims-audit` skill produced zero OVER-CLAIM rows.

## Common failure modes

- Slide footer auto-stamped with author identity from the slide tool (PowerPoint, Keynote).
- Demo recording with terminal showing `whoami` / hostname in prompt.
- A new claim added without a corresponding entry in `docs/10_links.md`.
- "About us" slide accidentally drafted — must be removed entirely.

## Forbidden actions

- Naming team / school / individuals.
- Quoting a metric / outcome that the implementation has not actually demonstrated (use `claims-audit` first).
- Including any logo other than OSS project logos with attribution.
- Using stock photography that has embedded metadata or watermarks.
