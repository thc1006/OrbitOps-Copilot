# AC-S004-5b — i18n broader coverage acceptance criteria

**Parent SPEC**: SPEC-S004-5b-i18n-broader-coverage
**Closes**: issue #72 (I-17)

## Given / When / Then

### AC-S004-5b.1 — Contract test enumerates every migrated key
- **Given** the i18n contract test at `services/digital-twin-ui/src/i18n/i18n.test.tsx`
- **When** I read its `REQUIRED_KEYS` array
- **Then** every key listed in SPEC-S004-5b §5 (the ~58 new keys plus the 15 pre-existing) is present.
- **Verification**: `grep -c '^  "' src/i18n/i18n.test.tsx` resolves to ≥ 73.

### AC-S004-5b.2 — Locale bundles are at parity and complete
- **Given** the extended `REQUIRED_KEYS`
- **When** I run `npx vitest run src/i18n/i18n.test.tsx`
- **Then** all 5 cases in `describe("i18n resource bundles")` pass and the 3 cases in `describe("i18n init")` continue to pass.
- **Verification**: `npx vitest run src/i18n/i18n.test.tsx --reporter=default` exits 0.

### AC-S004-5b.3 — All 4 target pages render only via t()
- **Given** the migrated pages
- **When** I grep for Title-Case literal sentences in `src/pages/Copilot.tsx`, `Scenarios.tsx`, `Gateways.tsx`, `Overview.tsx`
- **Then** zero hardcoded English UI sentences remain (CSS-prop strings, MUI variant tokens, and JSX prop names are excluded — see SPEC §7.3 grep filter).

### AC-S004-5b.4 — Layout shell is fully migrated
- **Given** `src/layout/SideNav.tsx` and `src/layout/TopBar.tsx`
- **When** I grep with the same filter as AC-5b.3
- **Then** zero hardcoded English UI sentences remain. Specifically:
  - SideNav `groups[i].label` and `groups[i].items[j].label` are computed via `t("nav.*")`.
  - SideNav "External" overline is `t("nav.external")`.
  - SideNav "Sprint 1 · Local" badge is `t("common.envBadge")`.
  - TopBar "OrbitOps Copilot" brand is `t("common.brand")`.
  - TopBar "B5G / NTN" chip is `t("common.brandTag")`.
  - TopBar "scenario" / "t =" labels are `t("common.scenario")` / `t("common.tick")`.
  - TopBar "Refresh metrics" tooltip is `t("common.refresh")`.

### AC-S004-5b.5 — Cross-page semantic alignment (anti-pattern chain #3)
- **Given** SideNav group `Cluster` and SectionHeader `category="Cluster"` on Overview/Scenarios
- **When** I `grep -n 't("nav.cluster")' src/`
- **Then** the same key appears in `src/layout/SideNav.tsx` AND in `src/pages/Overview.tsx` AND in `src/pages/Scenarios.tsx`.
- **Negative**: `grep -n '"sidenav\.cluster"\|"overview\.categoryCluster"' src/` returns nothing — i.e., we did NOT split the concept into per-page parallel keys.
- Same alignment check for: `nav.workloads`, `nav.events`, `nav.aiOps`, `nav.overview`, `nav.scenarios`, `nav.beams`, `nav.gateways`, `nav.satellitePass`, `nav.anomalies`, `nav.copilot`.

### AC-S004-5b.6 — No vitest regression
- **Given** the post-merge state of the digital-twin-ui workspace
- **When** I run `npx vitest run`
- **Then** total test count is ≥ 117 (the count on `main` at the start of this SPEC). Equality is acceptable (no new test files needed; we extend assertions in-place); >117 is also acceptable if the implementation surfaces a useful new case.

### AC-S004-5b.7 — verify.sh green
- **Given** the changes are committed
- **When** I run `./verify.sh`
- **Then** all 9 blocking gates and the 2 advisory gates are green.
