# Sprint Review — Sprint 3

| 欄位 | 值 |
|---|---|
| Sprint | 3 |
| Dates | 2026-05-04 ~ 2026-05-06 |
| Facilitator | architect (self-review; single-contributor sprint) |
| Demo recording | N/A — RunSpace deliverables intentionally skipped per `user_skip_rules.md`; live cluster `cloudnative-dev-telco` (31.41.34.19, kubeadm single-node) is the durable demo surface |

## Sprint goal restatement

> **「RunSpace 提交完成」**：10 頁簡報 + 90s 影片 + 3min 英文字幕影片 + 投件 zip + claims-audit 全 pass

**狀態**：goal 本身被 user 主動撤回（user_skip_rules.md 2026-05-04）。Sprint 改為「**closeout sprint**」：把 Sprint-2 carry-over 收完、release 第一個正式 tag、把 demo path 拉到 prod-ready visual quality。

## Sprint outcome

| Vertical Slice | Status | AC pass | Driver PR | Notes |
|---|---|---|---|---|
| VS-13 CesiumJS satellite pass | ✅ done | AC-S004-13a/b/c/d/e (15 of 17 ACs) | #74/#77/#78/#79/#84/#87/#88 | S2→S5 + ops console redesign + flicker fix; AC-13e.8 reference-stability codified |
| VS-14 RunSpace 10-page slide PDF | ⏭ skipped | — | — | user_skip_rules.md |
| VS-15 90-second demo video | ⏭ skipped | — | — | user_skip_rules.md |
| VS-16 3-minute English-subtitled video | ⏭ skipped | — | — | user_skip_rules.md |
| VS-17 Nephio kpt package full doc | ✅ done | AC-S006-7 | #85 | `kpt fn render` dry-run + `.krmignore` + verify.sh §5d advisory |
| VS-18 Pre-submission audit + zip | ⏭ skipped | — | — | user_skip_rules.md (deliverable-side) |
| Carry — Sprint-2 i18n broader (#72/I-17) | ✅ done | AC-S004-5b.1–.6 | #81 | en/zh-TW 0→91 keys, 5 pages migrated |
| Carry — tsconfig noEmit (#70/I-15) | ✅ done | — | #82 | replaces .gitignore workaround |
| Sprint closeout — image bump 0.1.2→0.1.3 | ✅ done | — | #83 | 3 manifests + Helm + compose |
| Sprint closeout — release notes + tag | ✅ done | — | #86 | first formal git tag in repo history (`v0.1.3-dev-sprint3` @ e1ed164) |
| Hot-fix — Cesium Ion warning | ✅ done | (post-tag) | #87 | ADR-011 offline imagery |
| Hot-fix — SatelliteView visual saga | ✅ done | (post-tag) | #88 | 8 commits chasing visual bugs → codified Chain #6 + Chain #X |

**16 PRs delivered (#73–#88), 10 ✅ ship + 4 ⏭ skip + 2 hot-fix**.

## What we shipped

- **First formal release tag** in repo history: `v0.1.3-dev-sprint3` @ `e1ed164` (2026-05-05). 200+ line release notes (`docs/releases/v0.1.3-dev-sprint3.md`). 50+ PRs grouped by sprint.
- **Live cluster pulled to parity**: kubeadm `cloudnative-dev-telco` (31.41.34.19) running emulator + copilot-api + digital-twin-ui all on `0.1.3-dev-sprint3`. R1/R2/R3 production drift items all closed (see memory `sprint3_state_2026-05-05.md`).
- **VS-13 satellite-pass viz** went from skeleton → polyline → animated → ops console redesign with 4 telemetry panels (anomaly banner, beam telemetry, handover events, live SNR sparkline). Demo path now tells a coherent story: `/scenarios` Ready → `/satellite-view` shows anomaly + sparkline drop → `/copilot` ask cites same metric.
- **i18n broader coverage**: 91 keys, en/zh-TW parity, 5 pages migrated, 3 anti-pattern chains caught in self-review.
- **Nephio kpt VS-17**: `packages/nephio-stubs/orbitops-groundstation-package/` passes `kpt fn render` dry-run; verify.sh §5d advisory gate.
- **Anti-pattern accountability**: 6 chains documented in release notes §8 + ADR-011 Appendix A + new `docs/reviews/anti-pattern-checklist.md`.
- **Offline-first imagery**: ADR-011 — no Cesium Ion, no external CDN, no token. Air-gappable demo.

## What we did NOT ship (and why)

- **VS-14 / VS-15 / VS-16 / VS-18 (RunSpace deliverables)** — user explicitly opted out of submission (`user_skip_rules.md`). Backlog status: archived under "投件 deliverables, won't-fix unless RunSpace re-engaged".
- **VS-8 real LLM (Ollama Qwen3.6)** — no GPU on dev machine (`user_skip_rules.md`). Deferred to Sprint-4+ once GPU available; mock provider remains canonical.
- **VS-12 voice interface stub** — low evidence value vs effort (`user_skip_rules.md`). Likely permanent skip.
- **Tag retag for #87/#88** — chose **not to retag** `v0.1.3-dev-sprint3`. PR #87/#88 are post-tag hot-fix on the visual layer; the live cluster image SHA `14bb344edb44` already includes them. Next tag will be `v0.1.4` or similar; rationale in `docs/releases/v0.1.3-dev-sprint3.md` §11 (added by this review).

## Metrics

- **AC pass rate**: 15 of 17 in-scope ACs (88%). The 2 not-passed (AC-13e.9 / AC-13e.10) are vitest count + verify.sh — both green at end of sprint, but counted as sprint-end status only.
- **`make verify` green**: yes (9 blocking + 3 advisory).
- **Test counts**: 109 pytest passing + 1 xfail-strict (voice S2-07), 140 vitest passing (was 122 pre-sprint), zero flake observed.
- **New backlog items opened during sprint**: 0 — every loose end was resolved or formally skipped.
- **Risks closed / opened (`risk-register.md`)**:
  - R-04 (version drift Helm 4 / Vite 8 / TS 6) — re-scored from L4×I3=12 to **L2×I3=6** (mitigated; lockfile pins, verify.sh checks, 5 weeks running clean).
  - R-09 (7-14 day budget overrun) — re-scored from L3×I5=15 to **L1×I5=5** (mitigated; 3 sprints shipped).
  - R-10 (RunSpace scoring weight changes) — **closed** (skip rule made this irrelevant).
  - **NEW**: R-13 — "single-contributor PR train review fatigue" — L4×I3=12 (visible in PR #88's 8-commit chase). Mitigation: anti-pattern checklist + Chain #X process rule.

## Demo recap

- **Live URL**: `http://31.41.34.19:30073/satellite-view` (kubeadm cluster).
- **Dry-run path** (verbal walk):
  1. `/scenarios` → "Ready for Copilot" button → loads beam-degradation scenario, ticks to t=240s.
  2. `/satellite-view` → anomaly banner appears (`beam-degradation active at scenario t = 240s — 2 beam(s) degraded`); 1 of 4 SNR sparklines drops 12 → 6 dB.
  3. `/copilot` → ask "Which beam is degrading and why?" → response cites `orbitops_beam_snr_db{beam=...}` from same time window.
- **UX surprises during sprint**:
  - User asked "你模擬這樣誰看的懂嗎" (who can read this) — drove the SatelliteView ops-console redesign.
  - Cesium Ion warning in DevTools — drove ADR-011.
  - Yellow polyline flicker — drove Chain #6 (Resium reference-stability).
- **Screenshots**: not captured this sprint; recommended for Sprint-4 (action item below).

## Retrospective

| Continue | Stop | Start |
|---|---|---|
| TDD red→green→refactor when domain logic changes (held throughout PRs #74–#85) | Shipping visual fixes without regression tests (PR #88's 8-commit chase) | Writing failing test FIRST for visual bugs (Chain #X) |
| ADR-driven decisions for cross-cutting concerns (ADR-011 caught Ion + reference-stability) | Trusting Edit-tool return codes alone (Chain #2) | Running `grep` POST-Edit as default reflex |
| Self-review fix-pack pattern (#81 fix-pack 5 items) — caught chain #1/#2/#3 before merge | Adding broad commits without self-review on the way | Pre-PR self-audit using anti-pattern checklist |
| Live cluster sync after every sprint (R1 closure model) | Letting tag drift from main without errata note | Adding §"Post-tag errata" to release notes when hot-fix lands |

## Action items

- [x] Write `docs/reviews/anti-pattern-checklist.md` (this sprint review) — owner: architect — done
- [x] Add §11 "Tag policy + post-tag errata" to `docs/releases/v0.1.3-dev-sprint3.md` — owner: release-engineer — done
- [x] Update memory `sprint3_state_2026-05-07.md` (supersede 2026-05-05) — owner: architect — done
- [ ] Capture demo screenshots from live cluster for next release notes — owner: architect — Sprint-4 kickoff
- [ ] Decide Sprint-4 sprint goal (or formally pause) — owner: PO (= user) — when ready

## Risk register diff (this sprint)

- **Re-scored**: R-04 (version drift) 12→6 mitigated; R-09 (budget overrun) 15→5 mitigated.
- **Closed**: R-10 (RunSpace weight changes) — skip rule made obsolete.
- **New**: R-13 — single-contributor review fatigue; L4×I3=12.

## Next sprint adjustments

- **Sprint-4 not scheduled**. Repo is in honest "paused" state with 0 open PR / 0 open issue.
- Carry-over slices: none. All in-scope work merged.
- Backlog candidates if user wants to resume:
  - LLM provider eval harness (no GPU; grounding regression test against multiple OpenAI-compatible endpoints).
  - Closed-loop GitOps reconcile demo (copilot suggestion → ArgoCD apply → observe metric ripple).
  - OIDC + JWT for copilot-api (auth boundary).
  - Performance hardening (k6 load test on emulator, Prometheus scrape latency budget).
- **None of the above are user-committed**. Sprint-4 plan only opens when user picks one.

## Anonymity audit

> Per CLAUDE.md §2.1 (anonymity policy relaxed 2026-05-01), repo content does NOT need anonymity scrubbing. This section retained from template for RunSpace-submission-time use only.

- [x] sprint review notes 不含未來投件需要清的 placeholder（不適用此 sprint — 沒投件）
- [x] demo 影片 metadata — N/A (no video this sprint)
- [x] screenshot 已遮 OS toolbar — N/A (no screenshot this sprint; action item to capture later)

## Sign-off

- [x] PO (user) — accepts sprint outcome (skip rules + closeout)
- [x] Architect — SPEC / ADR / AC consistent (SPEC-S004-13d/13e + AC-S004-13d/13e + ADR-011 all merged)
- [x] Security-reviewer — `scripts/check-no-secrets.sh` clean; no real secret in 16 PRs
- [x] Release-engineer — `v0.1.3-dev-sprint3` tagged + GitHub Release published; post-tag errata documented
