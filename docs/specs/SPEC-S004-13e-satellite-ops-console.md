# SPEC-S004-13e — Satellite-pass ops-console redesign

**Parent**: SPEC-S004-13d (animated satellite + Play/Pause/Reset)
**Status**: Draft → in progress (2026-05-06)
**Closes**: `/satellite-view` UX gap reported as "這在模擬什麼東西" / "誰看得懂" (2026-05-05) — pre-redesign page was a single-globe view that did not communicate the B5G/NTN ground-station-ops domain.
**Sibling work**: PR #87 (offline imagery, ADR-011), PR #88 (this redesign)

## 1. Goal

Restructure `/satellite-view` from a single-purpose globe viewer into a **B5G/NTN ground-station operations console** — a single screen where an operator can simultaneously see (a) physical reality (satellite over the globe), (b) per-beam signal quality, (c) handover events, and (d) anomaly alerts driven by `/metrics`.

The page must, at a glance, communicate to a first-time evaluator that the project is a NTN ground-station digital twin, not a generic Cesium/IoT demo.

## 2. Non-goals

- New data sources. The redesign is composition of existing `MetricsSnapshot` fields (`beams[]`, `active_anomalies`, `t_seconds`, etc.).
- New chart libraries. Reuses `MetricSparkline` (Recharts), `StatusChip`, `MetricNumber`, `useMetricsHistory`.
- Camera control / interactive globe annotation. The globe stays read-only.
- Real TLE-driven orbits. The demo `calculateSinPass` pass is unchanged.
- A second non-en/zh-TW locale. en + zh-TW parity continues.

## 3. Inputs

- `services/digital-twin-ui/src/pages/SatelliteView.tsx` (post-VS-13-S5; the 70vh-globe-only layout from PR #84).
- `useMetricsPoll` provides `data: MetricsSnapshot | null` (5 s polling cadence, already in scope).
- `useMetricsHistory(data)` provides 60 s sliding window of past `MetricsSnapshot` per beam — already used by Copilot's inline sparkline.
- ADR-011 offline NaturalEarthII baseLayer is preserved.

## 4. Outputs

### 4.1 Layout

8/4 MUI Grid v2 split on `lg` breakpoint (xs:12 stacks vertically):

```
┌─────────────────────────────────────────────────────────────┐
│ SectionHeader (uses nav.workloads / nav.satellitePass)      │
│ Anomaly banner (only when data.active_anomalies.length > 0) │
├─────────────────────────────────┬───────────────────────────┤
│  Globe (lg:8, 60vh)              │  Telemetry sidebar (lg:4)│
│  - NYCU GS pin                   │  ┌─────────────────────┐ │
│  - Pass polyline                  │  │ Pass progress       │ │
│  - Satellite (animated)            │  └─────────────────────┘ │
│  - Beam coverage cones             │  ┌─────────────────────┐ │
│                                   │  │ Active beams (N)    │ │
│                                   │  └─────────────────────┘ │
│                                   │  ┌─────────────────────┐ │
│                                   │  │ Handover events     │ │
│                                   │  └─────────────────────┘ │
│                                   │  ┌─────────────────────┐ │
│                                   │  │ Live SNR sparkline   │ │
│                                   │  └─────────────────────┘ │
├─────────────────────────────────┴───────────────────────────┤
│ Play / Pause / Reset (full width below grid)                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Panels

| Panel | Content | Empty state | Source |
|---|---|---|---|
| Anomaly banner | `t("satellite.anomaly.banner", { kind, t, count })` | hidden entirely | `data.active_anomalies` |
| Pass progress | `<LinearProgress value={passFraction*100}>` + `t("satellite.playback.progress")` + `t("satellite.playback.speedHint")` | always shown | local `passFraction` state |
| Active beams | Per-beam: `beam_id` (mono) + `<MetricNumber unit="dB">` + `<StatusChip>` | `t("satellite.beams.empty")` | `data.beams[]` |
| Handover events | Per beam where `handover_state > 0`: `beam_id` + state label (preparing/FAILURE), color-coded warning/error | `t("satellite.handover.empty")` | `data.beams[].handover_state` |
| Live SNR sparkline | One `<MetricSparkline metric="snr_db">` per beam | `t("satellite.sparkline.empty")` | `useMetricsHistory(data)` |

### 4.3 i18n keys

11 new keys under `satellite.*`:

```
satellite.anomaly.banner       "{{kind}} active at scenario t = {{t}}s — {{count}} beam(s) degraded"
satellite.beams.title          "Active beams ({{count}})"
satellite.beams.empty          "No beams active. Load a scenario from Scenarios."
satellite.handover.title       "Handover events"
satellite.handover.empty       "No handover events."
satellite.handover.preparing   "preparing"
satellite.handover.failure     "FAILURE"
satellite.sparkline.title      "Live SNR (60 s window)"
satellite.sparkline.empty      "Polling /metrics — sparkline appears after the second sample."
satellite.subtitle             "Cesium globe + per-beam telemetry. ..."
satellite.timeline.title       "Pass progress"
```

Plus the 5 existing `satellite.playback.*` from SPEC-S004-13d.

### 4.4 Visual reference stability

Per the flicker fix (PR #88 commit `7527ed5`), all static `Color.fromCssColorString(hex)` and `new Cartesian2(x, y)` instances MUST be hoisted to module scope. Per-cone dynamic colors MUST be wrapped in `useMemo` keyed on the `beamCones` array reference. See ADR-011 §"Resium reference-stability gotchas" appendix.

## 5. Test strategy

This is a layout/composition change with **fully testable React surface**:
- All 4 panels are React composition of already-mocked primitives (`StatusChip`, `MetricNumber`, `MetricSparkline`).
- `vi.mock("../components/MetricSparkline")` with discriminable `data-testid`.
- Render assertions against panel-specific testids cover the contracts in §4.2.

This SPEC explicitly **rejects** `[skip-tdd]` for the panel rendering — those panels are the value of the redesign, and they must be test-asserted. The Cesium-runtime parts (camera, layout CSS, mouse interaction) remain `[skip-tdd]` per established jsdom limitation.

## 6. Acceptance criteria

See `docs/acceptance/AC-S004-13e-satellite-ops-console.md`. Summary:

1. Anomaly banner renders only when `active_anomalies.length > 0`.
2. Active beams panel renders one row per beam in `data.beams`, each row contains the beam_id text.
3. Active beams panel renders empty-state text when `data.beams` is empty.
4. Handover events panel renders only beams where `handover_state > 0`.
5. Handover events panel uses warning color for state=1 (preparing) and error color for state=2 (failure).
6. SNR sparkline panel renders one `MetricSparkline` mock element per beam.
7. SNR sparkline panel renders empty-state text when `data.beams` is empty.
8. Section header uses `t("nav.workloads")` / `t("nav.satellitePass")` (matches SideNav cross-page key alignment per chain #3).
9. `npx vitest run` total ≥ 137 (was 133 + 4 minimum new panel tests).
10. `./verify.sh` 9 blocking + 3 advisory all green.

## 7. Constraints

- **Anti-pattern chain accountability**:
  - Chain #3 cross-page semantic alignment: `nav.workloads` shared with SideNav; `nav.satellitePass` shared with SideNav nav item. Verified.
  - Chain #6 (NEW) reference-stability for Cesium props: hoist constants + useMemo dynamics. Documented in ADR-011 appendix.
- **i18n parity** preserved: every new key in en + zh-TW; `REQUIRED_KEYS` extended.
- **Test discipline**: ≥4 panel render tests required before merge.

## 8. Demo relevance

Per `docs/08_demo_script_3min.md`, the ops console is the **domain anchor** for the demo:
- Click "Ready for Copilot" on `/scenarios` → `snr_drop` injected
- Switch to `/satellite-view` → see banner + cone color flip + sparkline drop
- Switch to `/copilot` → ask preset → evidence cites the same `beam-1 snr_db` value visible on the sparkline panel

The redesign's value proposition: cite Copilot evidence visible on the screen, not from a black-box LLM.

## 9. Open questions

- Q1 Should the sparkline panel use `MetricSparkline` (Recharts inline) or a richer time-series chart? → **A**: stay minimal with `MetricSparkline` (already used by Copilot for citation hints; visual consistency).
- Q2 Should the handover-events panel persist past events beyond the current `data` snapshot? → **A**: no, current snapshot only. A persistent event log is Sprint-4+ work.
- Q3 Should the anomaly banner show severity (warning/error) based on which anomaly is active? → **A**: v1 uses `severity="warning"` for all. Differentiation deferred.

## 10. Future work (not in this SPEC)

- Tracked-entity camera follow (set `viewer.trackedEntity` to satellite when playing).
- Time-axis on the polyline (color gradient by t / arrowhead at current position).
- Real per-beam azimuth pointing (currently zenith).
- Persistent handover event log with timestamps.
- Anomaly banner severity differentiation per anomaly kind.
