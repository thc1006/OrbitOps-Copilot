# ADR-008 — Sprint-1 frontend stack pin (React 18.3, Vite 5.4, Tailwind 3.4)

- **Status**: Accepted (Sprint 1).
- **Date**: 2026-05-01.
- **Supersedes**: none.
- **Superseded by**: planned ADR-NNN at the start of Sprint 2 / VS-13 (CesiumJS pass viz upgrade).

## Context

`CLAUDE.md §4` (Coding rules — TypeScript / React) prescribes:

> React 19 + Vite 8 + TypeScript 6 (嚴格模式) + Tailwind 4. 視覺化：CesiumJS 1.140 為主、Three.js r184 為備案；圖表：Recharts.

The actual `services/digital-twin-ui/` shell shipped in PR #18 (= PR #6 superseder) installs:

| Stack item | CLAUDE.md §4 target | Sprint-1 actual | Reason |
|---|---|---|---|
| React | 19.x | **18.3.x** | npm-stable; React 19 typings still trickle through testing-library / vitest at the time of cut; downgrade to 18.3 restores zero-config tests. |
| Vite | 8.x | **5.4.x** | Vite 7/8 require Node ≥20 + ESM-only plugins; 5.4 keeps the Sprint-1 demo runnable on the broadest set of contributor machines. |
| TypeScript | 6.x | **5.6.x** | TS 6 was released after the Sprint-1 cut; some plugins (eslint-config) hadn't caught up. |
| Tailwind | 4.x | **3.4.x** | Tailwind 4 changed the config surface (`@tailwindcss/vite`); the Sprint-1 SVG shell uses standard utility classes only and benefits nothing from the migration. |
| 3D viz | CesiumJS 1.140 | **SVG** | P0 `digital-twin-ui` is a static SVG-based shell (see `DigitalTwinView.tsx:1-3` header comment). CesiumJS pass viz lands in **VS-13** as planned in the agile backlog. |

The CLAUDE.md prescription was authored when Sprint-1 work was being scoped against "what versions will exist *during* Sprint-2". When Sprint-1 actually shipped the SVG shell, the team consciously pinned to today's stable.

## Decision

Pin the Sprint-1 frontend stack to **React 18.3 + Vite 5.4 + TypeScript 5.6 + Tailwind 3.4 + SVG**. Defer the CLAUDE.md §4 targets (React 19 / Vite 8 / TS 6 / Tailwind 4 / CesiumJS) to **Sprint 2** when VS-13 (real satellite-pass animation) lands.

The `services/digital-twin-ui/package.json` carries an inline `_note` field that points readers at this ADR; the README also documents the trade-off.

CLAUDE.md §4 is **not** edited to match Sprint-1 — its prescription describes the *target* state. The drift is documented here, not by retroactive policy rewrite.

## Consequences

### Accepted
- The Sprint-1 demo runs on Node ≥18 (was: Node ≥20 for Vite 8).
- Tests use the well-trodden `vitest` 2.x + Testing-Library 16 path; no React 19 transitional warnings.
- No CesiumJS bundle (~3 MB minified) in the Sprint-1 build.

### Rejected
- Upgrading the shell to React 19 *now* would force a parallel migration of every TS plugin in CI. The benefit (concurrent rendering features) is unused by the SVG shell.
- Locking CLAUDE.md §4 to "React 18.3 today" hides the future intent. The explicit drift here is preferred.

### Audit / verification
- `services/digital-twin-ui/package.json` versions match this ADR.
- Sprint 2 entry gate in `docs/agile/sprint-02-plan.md` (when authored) must list "stack upgrade per ADR-008 retirement" as a precondition for VS-13.

## Alternatives considered

1. **Match CLAUDE.md §4 today** — would require shipping un-released-or-just-released versions and absorbing tooling instability during the Sprint-1 cut. Rejected.
2. **Rewrite CLAUDE.md §4 to today's versions** — the prescription document then loses its forward-looking intent. Rejected; prefer explicit ADR drift.
3. **Skip the digital-twin-ui shell entirely until Sprint 2** — would have left the Copilot panel unrepresented in Sprint-1 demos and weakened the AC-001 walk-through. Rejected.

## References

- `services/digital-twin-ui/package.json` (`_note` field).
- `services/digital-twin-ui/README.md` (Sprint-1 stack rationale).
- `docs/agile/backlog.md` — VS-13 entry (CesiumJS pass viz).
- CLAUDE.md §4 (the target-state coding rules this ADR notes drift against).
- CLAUDE.md §12.1 (SDD requirement: "重大技術選型寫 ADR" — this ADR satisfies that bar for the stack pin).
