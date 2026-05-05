# SPEC-S004-5b — i18n broader coverage (Copilot/Scenarios/Gateways/Overview + Layout)

**Parent**: SPEC-004 §AC-S004-5
**Status**: Draft → in progress (2026-05-04)
**Closes**: issue #72 (I-17)
**Sibling work**: T1 PR #68 (initial AC-S004-5 — Anomalies + Beams), PR #80 (initI18n(lng?) refactor)

## 1. Goal

Extend the i18n migration started in PR #68 to cover the four remaining pages and the always-visible Layout shell so that a `?lng=zh-TW` switch produces a fully Chinese UI rather than a mixed-language one. Close the asymmetric drift hazard described in issue #72: the current `REQUIRED_KEYS` enumeration only covers Anomalies + Beams, so a future English-only string added to Copilot / Scenarios / Gateways / Overview / SideNav / TopBar will silently slip through.

## 2. Non-goals

- The eslint-plugin-i18next "Step 2" path from issue #72 (write-time enforcement). That is deferred to a future SPEC; this SPEC only does the test-time `REQUIRED_KEYS` extension + content migration.
- Refactoring SectionHeader's API. The component already accepts free-form `category` / `title` strings; the call sites switch from string literals to `t(...)`, the component itself stays unchanged.
- New translatable strings inside SatelliteView / Beams / Anomalies (already migrated in PR #68 / VS-13). This SPEC strictly extends existing coverage.
- A second non-en/zh-TW locale (e.g. ja). zh-TW + en parity is the only contract.

## 3. Inputs

- Hardcoded English strings in:
  - `services/digital-twin-ui/src/pages/Copilot.tsx` (~14)
  - `services/digital-twin-ui/src/pages/Scenarios.tsx` (~10)
  - `services/digital-twin-ui/src/pages/Gateways.tsx` (~7)
  - `services/digital-twin-ui/src/pages/Overview.tsx` (~11)
  - `services/digital-twin-ui/src/layout/SideNav.tsx` (~12)
  - `services/digital-twin-ui/src/layout/TopBar.tsx` (~5)
- Existing bundles: `src/i18n/locales/en.json`, `src/i18n/locales/zh-TW.json` (15 keys today).
- Existing contract: `src/i18n/i18n.test.tsx` (`REQUIRED_KEYS` array).

## 4. Outputs

- en.json + zh-TW.json grow from 15 to ~73 keys, parity preserved.
- 6 source files migrated to `useTranslation` + `t(...)`.
- `REQUIRED_KEYS` extended to enumerate every newly-migrated key (so future English-only addition fails the contract test).
- All existing tests still green; vitest count grows by ≥1 (or assertions in i18n.test.tsx grow — see §6).

## 5. Interfaces / namespace plan

To prevent the cross-page semantic drift documented in PR #79 anti-pattern chain #3, shared concepts get a single canonical key under a shared namespace. Per-page namespaces only hold strings that are genuinely page-local.

```
nav.cluster              ← used by SideNav group "Cluster" + Overview/Scenarios category overline
nav.workloads            ← SideNav group + Beams/Gateways/SatelliteView category
nav.events               ← SideNav group + Anomalies category (already implicit in PR #68 — re-key)
nav.aiOps                ← SideNav group + Copilot category
nav.overview             ← SideNav item + Overview title
nav.scenarios            ← SideNav item + Scenarios title
nav.beams                ← SideNav item + (existing) beams.* parent
nav.gateways             ← SideNav item + Gateways title
nav.satellitePass        ← SideNav item + (existing SatelliteView title from VS-13)
nav.anomalies            ← SideNav item + (existing) Anomalies title
nav.copilot              ← SideNav item + Copilot title
nav.external             ← SideNav "External" overline

common.refresh           ← TopBar refresh tooltip
common.loading           ← any "Loading…"
common.scenario          ← TopBar "scenario" label
common.tick              ← TopBar "t =" label
common.brand             ← "OrbitOps Copilot" (TopBar)
common.brandTag          ← "B5G / NTN" (TopBar)
common.envBadge          ← "Sprint 1 · Local" (SideNav header)

copilot.subtitle
copilot.askButton
copilot.askingButton
copilot.askPlaceholder
copilot.tryLabel
copilot.preset.beamDegrading
copilot.preset.gatewayRisk
copilot.preset.next30min
copilot.responseHeader
copilot.confidenceLabel        # value: "confidence {{percent}}%"
copilot.refusedPrefix          # value: "Refused: {{reason}}"
copilot.section.summary
copilot.section.likelyCause
copilot.section.recommendedActions
copilot.section.riskIfIgnored
copilot.section.metricCitations  # value: "Metric citations ({{count}})"

scenarios.subtitle
scenarios.preset.beamDegradation
scenarios.preset.handoverFailure
scenarios.preset.gatewayFallback
scenarios.readyForCopilot
scenarios.customLoadFutureWork
scenarios.tickPickLabel        # "Seconds"
scenarios.checklist.askCopilot
scenarios.checklist.retryHint

gateways.subtitle
gateways.statusAvailable
gateways.statusDown
gateways.empty
gateways.fieldAvailable
gateways.fieldLoad

overview.subtitle              # if any; otherwise omit
overview.metric.beams
overview.metric.gateways
overview.metric.activeAnomalies
overview.metric.tick
overview.beamSummary
overview.table.beamId
overview.table.snr
overview.table.latency
overview.table.loss
overview.table.doppler
overview.table.handover
overview.table.status
overview.empty                 # "No beams. Load a scenario from Scenarios."
```

Total: 12 (`nav.*`) + 7 (`common.*`) + 16 (`copilot.*`) + 8 (`scenarios.*`) + 5 (`gateways.*`) + ~10 (`overview.*`) ≈ **58 new keys** + 15 existing = **~73 total**.

## 6. Test strategy

This is a TDD slice; the failing test commit lands first.

- **Red commit** (`red(SPEC-S004-5b):`): extend `REQUIRED_KEYS` in `src/i18n/i18n.test.tsx` to list all ~58 new keys. Tests "en.json covers every required key", "zh-TW.json also covers every required key", "values are non-empty strings" all fail because the bundles haven't grown yet.
- **Green commit**: add keys to en.json + zh-TW.json (parity preserved by the existing identical-key-sets test); migrate the 6 source files; run vitest until green.
- No new test file is created — the existing contract is the test surface. This is consistent with PR #68's pattern (extend, don't fork).
- Optional refactor commit: only if the page rewrites surface duplicated literal mapping; currently no need is anticipated.

## 7. Acceptance criteria (links AC-S004-5b — see `docs/acceptance/AC-S004-5b-...md`)

1. `npx vitest run src/i18n/i18n.test.tsx` passes with the extended `REQUIRED_KEYS`.
2. `npx vitest run` total count ≥ 117 (no regression from main).
3. `git grep -nE '"[A-Z][a-zA-Z]+ [a-zA-Z]+"' src/pages/{Copilot,Scenarios,Gateways,Overview}.tsx src/layout/{SideNav,TopBar}.tsx | grep -vE '(env_|monoFamily|primary|secondary|outlined|contained|small|medium|fixed|permanent|column|row|rounded|never|always|action\.|primary\.|background\.|text\.|warning\.|error\.|success\.|action |\bof\b|spaceBetween|flex-end|flex-start|center|baseline|stretch|category="[a-z]|title="[a-z]|placeholder="$|aria-|data-)' | wc -l` returns 0 (no Title-Case literal sentences remaining outside of allowed CSS-prop / MUI variant / debug-id contexts).
4. SideNav `groups[i].label` and SectionHeader `category=...` resolve to the **same** i18n key for shared concepts (Cluster, Workloads, Events, AI Ops). Verified by reading the source: `t("nav.cluster")` is referenced from both SideNav.tsx and (e.g.) Overview.tsx.
5. `./verify.sh` 9 blocking + 2 advisory all green.

## 8. Constraints

- Anti-pattern chain accountability (carry-over from VS-13 closeout):
  - **#1 grep-verify before write**: every key added to en/zh-TW bundles must come from a string already grep-verified to exist in source. No "I think this string is there".
  - **#2 POST-WRITE verify**: after each Edit, re-grep the file to confirm the literal is gone and the `t(...)` call is present. Tool return success ≠ effect.
  - **#3 cross-page semantic alignment**: shared concepts use the SAME key (see `nav.*` namespace). Do not introduce `sidenav.cluster` + `overview.categoryCluster` parallel keys.
  - **#4 NaN guard**: not applicable to this slice (no numeric path).
  - **#5 first-call-only ignore**: not applicable (handled by PR #80).
- Locale parity is non-negotiable: `expect(onlyEn).toEqual([])` and `expect(onlyZh).toEqual([])` must stay green.
- No string concatenation in JSX: use i18next interpolation (`{{percent}}`, `{{count}}`) for runtime values. Same convention as `anomalies.injectSuccess`.

## 9. Open questions

- Q1 Should "Sprint 1 · Local" stay user-visible at all? It's stale (we're at Sprint 3+ frontend stack). Keeping it i18n'd preserves behavior; renaming is out-of-scope here. → **Answer: keep + i18n; rename is separate.**
- Q2 Layout components are imported by the App shell which mounts on every route. Does i18n init order guarantee that the bundles are loaded before SideNav renders? → **Answer: yes; `main.tsx` awaits `initI18n()` before `ReactDOM.createRoot().render()` (verified PR #80).**
- Q3 Should table headers in Overview.tsx use `<Trans>` to allow inline markup? → **Answer: no; they're plain strings. `t(...)` is sufficient.**

## 10. Demo relevance

`docs/08_demo_script_3min.md` Demo step 4 ("show zh-TW switch") currently looks half-Chinese because Layout + 4 pages bleed English into the screenshot. Closing this SPEC makes the language switch a clean, evidence-able demo beat.
