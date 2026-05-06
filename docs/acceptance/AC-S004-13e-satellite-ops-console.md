# AC-S004-13e — Satellite-pass ops-console acceptance criteria

**Parent SPEC**: SPEC-S004-13e-satellite-ops-console

## Given / When / Then

### AC-S004-13e.1 — Anomaly banner appears only when active_anomalies non-empty

- **Given** `<SatelliteView data={null} />` (or data with `active_anomalies: []`)
- **When** rendered
- **Then** no element matching `role="alert"` with banner text is in the document.
- **Counter-test**: when `data.active_anomalies = ["snr_drop"]`, the alert IS in the document and contains the text "snr_drop".

### AC-S004-13e.2 — Active beams panel renders one row per beam

- **Given** `data.beams = [beam-1, beam-2, beam-3]`
- **When** rendered
- **Then** the page contains exactly 3 elements with text `beam-1`, `beam-2`, `beam-3` inside the active-beams panel (assertable via `getByText`).

### AC-S004-13e.3 — Active beams panel empty state

- **Given** `data = null` OR `data.beams = []`
- **When** rendered
- **Then** the empty-state text from `t("satellite.beams.empty")` ("No beams active. Load a scenario from Scenarios.") is visible.

### AC-S004-13e.4 — Handover events panel filters by handover_state > 0

- **Given** `data.beams` with mixed `handover_state` values (0, 1, 2)
- **When** rendered
- **Then** only beams with `handover_state > 0` appear in the handover events panel.
- **Visual contract**: state=1 renders the i18n string `t("satellite.handover.preparing")` ("preparing") with `color: warning.main`; state=2 renders `t("satellite.handover.failure")` ("FAILURE") with `color: error.main`.

### AC-S004-13e.5 — SNR sparkline panel renders one MetricSparkline per beam

- **Given** `data.beams = [beam-1, beam-2]` (each with `snr_db` defined)
- **When** rendered
- **Then** the SNR sparkline panel contains exactly 2 `MetricSparkline` mock elements (asserted via `data-testid="mock-sparkline-..."` from the `vi.mock("../components/MetricSparkline")` factory, mirroring the Copilot.test.tsx mock pattern).

### AC-S004-13e.6 — Section header uses nav.* shared keys

- **Given** the rendered page
- **When** the SectionHeader's `category` and `title` props are inspected
- **Then** they resolve from `t("nav.workloads")` and `t("nav.satellitePass")` respectively. Assertable via `getByText("Workloads")` (en) or `getByText("工作負載")` (zh-TW).
- **Negative**: zero hardcoded `category="Visualization"` or `title="Satellite Pass"` literal in SatelliteView.tsx (chain #1 grep-verify).

### AC-S004-13e.7 — vitest count ≥ 137

- **Given** the post-merge state
- **When** `npx vitest run` is executed
- **Then** total tests is ≥ 137 (was 133; minimum +4 for AC-13e.{1,2,4,5} + ADR-011-appendix indirect coverage). Equality at 137 is acceptable; > 137 is acceptable if redundant edge cases were added.

### AC-S004-13e.8 — Visual-reference-stability invariant

- **Given** the SatelliteView source
- **When** I `grep -nE 'Color\.fromCssColorString|new Cartesian2|Cartesian3\.fromDegrees' src/pages/SatelliteView.tsx`
- **Then** zero matches occur **inside the JSX `return` block** (i.e. inside `<Viewer>...</Viewer>`); all such constructions are at module scope OR inside `useMemo`.
- **Negative**: zero `material={Color.fromCssColorString(...)}` style inline-construction props in JSX.

### AC-S004-13e.9 — `./verify.sh` green

- **Given** changes are committed
- **When** I run `./verify.sh`
- **Then** all 9 blocking gates and 3 advisory gates are green.

### AC-S004-13e.10 — i18n bundle parity preserved

- **Given** the i18n contract test
- **When** `npx vitest run src/i18n/i18n.test.tsx` is executed
- **Then** all 7 cases in `describe("i18n resource bundles")` and `describe("i18n init")` pass; en + zh-TW have identical key sets; every entry in the extended `REQUIRED_KEYS` is non-empty in both locales.
