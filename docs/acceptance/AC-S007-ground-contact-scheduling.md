# AC-S007 — Ground-station contact scheduling

| Field | Value |
|---|---|
| Parent SPEC | SPEC-S007 |
| Sprint | 6 (VS-25) |
| Status | Draft (2026-07-02) — implemented + verified in `services/ground-scheduler/` |

Each AC is verifiable by an automated test in `services/ground-scheduler/tests/` (or by `python -m ground_scheduler.cli`).

## AC-S007.1 — Real TLE parses into satellites
**Given** the bundled `data/sample_tles.txt` (real CelesTrak TLEs),
**When** `load_tles()` reads it,
**Then** it returns ≥5 `EarthSatellite` objects including "ISS (ZARYA)". *(test_contacts)*

## AC-S007.2 — Contact windows are physically valid (real geometry)
**Given** the satellites + ≥3 ground stations over a fixed 12-hour window anchored to the sample's TLE epoch,
**When** `compute_contacts(..., min_elevation_deg=10.0)` runs (skyfield `find_events`),
**Then** ≥1 window is produced, and **every** window satisfies: `aos < los`, `0 < duration_s < 1800` (LEO passes are minutes), `10.0 ≤ max_elevation_deg ≤ 90.5`, and windows are sorted by AOS. *(test_contacts)*

## AC-S007.3 — High-latitude station sees polar/SSO satellites
**Given** the enriched sample includes sun-synchronous satellites (~98° inclination: NOAA-20/21, Landsat-8/9, Sentinel-2A),
**When** the demo runs,
**Then** a polar station (Svalbard, 78°N) has **>0** scheduled/observed contacts (validating multi-inclination realism), whereas a purely 41–52° sample would yield zero. *(cli demo / manual sanity)*

## AC-S007.4 — Antenna conflicts are resolved
**Given** two contact windows overlapping in time at the same station,
**When** `schedule()` runs with that station having **1** antenna,
**Then** exactly one is `scheduled` and the other is `rejected`; **and** with **2** antennas both are `scheduled`. *(test_scheduler)*

## AC-S007.5 — Conservation + bounded metrics
**Given** any set of windows,
**When** scheduled,
**Then** `n_scheduled + n_rejected == n_windows`, and every per-station `utilization ∈ [0, 1]` when a horizon is supplied. *(test_scheduler)*

## AC-S007.6 — Priority ordering
**Given** two windows that would conflict at a 1-antenna station and one satellite has higher `priority`,
**When** scheduled,
**Then** the higher-priority satellite's window is the one scheduled. *(test_scheduler)*

## AC-S007.7 — Side-effect-free / honest boundary
**Given** the whole pipeline,
**When** any function runs,
**Then** it performs **no cluster mutation, no git write, and no network call in the tested path** (bundled TLE only); the CLI advertises "dry-run … no cluster mutation". *(test_cli_smoke + code review)*

## AC-S007.8 — Determinism
**Given** the same bundled TLE + same fixed window,
**When** the demo is run twice,
**Then** it produces the identical schedule + metrics. *(verified: two independent runs byte-identical)*

---

**Verification status (2026-07-02):** AC-S007.1/.2/.4/.5/.6/.7 covered by 9 passing pytest; AC-S007.3/.8 verified by independent CLI runs (Svalbard 0→15 windows after enrichment; pass durations median 9.4 min within the researched 5–12 min bracket; reproducible). ruff clean.
