---
name: claims-audit
description: Audit every pitch / docs claim into one of {implemented, simulated, planned, external_reference}. Block over-claiming.
---

## Overview

Truth-in-pitch enforcement. Every assertion in slides, demo scripts, README, or `docs/*` must be one of:

- **implemented**: actually runs in this repo today; testable via `./test.sh`.
- **simulated**: produced by emulator or mock; explicitly labelled "simulation" in surrounding text.
- **planned**: on the roadmap; tagged P1 / P2 / P3 with backlog ID.
- **external_reference**: cites third-party fact with URL + date (3GPP, NVIDIA, Nephio, etc.).

Anything outside these four categories is **over-claiming** and must be rewritten or removed.

## Triggers

- Before any RunSpace submission (final gate).
- Reviewing PRs that touch `README.md`, `docs/01`, `docs/06`, `docs/07`, `docs/08`, `docs/03`.
- After any new feature lands — re-classify previously-"planned" → "implemented".

## Inputs

- The doc / slide / video script under audit.
- `docs/00_research_2026_04.md` (external_reference allowlist).
- `docs/10_links.md` (URLs).
- `docs/agile/backlog.md` (planned items).
- Working tree of `services/` (implemented features).

## Step-by-step workflow

1. Extract every factual / capability claim (sentence-by-sentence).
2. For each claim, label one of the four categories. Be ruthless on sentences using "we deliver", "we provide", "the system can".
3. **implemented** claim → verify by running the relevant test or pointing to a passing AC.
4. **simulated** claim → confirm wording explicitly says simulation / emulation; otherwise rewrite.
5. **planned** claim → must reference SPEC-NNN or backlog item.
6. **external_reference** claim → cross-check `docs/00` table; ensure URL exists in `docs/10_links.md`.
7. Produce audit report: 4-column table (claim, category, evidence, action).
8. Open issues / send back to writer for any uncategorizable line.

## Output format

```markdown
| Claim | Category | Evidence | Action |
|---|---|---|---|
| "Cloud-native deployable sandbox." | implemented | docker-compose + kind manifests | none |
| "30-second SLA on anomaly visibility." | planned | SPEC-005, S1-07 | mark planned |
| "Real Ka-band steering." | OVER-CLAIM | none | REMOVE |
```

## Verification checklist

- [ ] No claim labelled "implemented" without a passing test or working command.
- [ ] No simulated claim without surrounding clarifying language.
- [ ] No planned claim without a SPEC / backlog ID.
- [ ] No external_reference without a `docs/10_links.md` URL.
- [ ] Zero rows labelled OVER-CLAIM.
- [ ] `./verify.sh` clean.

## Common failure modes

- Marketing-style adjectives ("seamlessly", "complete", "real-time") promote planned features into implemented.
- "Future-proof" used to gloss over un-implemented integrations.
- Claiming Sionna RT / AODT integration without P2 caveat.
- Stating LLM model name as if proven (validate against AC-003 grounding tests first).

## Forbidden actions

- Marking your own draft "implemented" without running the test.
- Removing the audit table from a PR after pushback (keep audit history).
- Touching the implementation to "fix" a claim instead of rewriting the claim.
