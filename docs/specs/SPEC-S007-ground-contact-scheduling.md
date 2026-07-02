# SPEC-S007 — Ground-station contact scheduling (real-TLE PoC)

| Field | Value |
|---|---|
| Status | Draft (2026-07-02) — Sprint-6 candidate (VS-25); PoC implemented at `services/ground-scheduler/` |
| Parent | SPEC-006 (k8s-deployment) · extends SPEC-S006-VS21 (closed-loop GitOps) |
| Owner | ran-ntn-engineer + k8s-platform-engineer + llm-copilot-engineer |
| Sprint | 6 (VS-25) — RunSpace-2026 finals technical kernel |
| Depends on | SPEC-S006-VS21 (safe-action / dry-run), ADR-013 (closed-loop apply), ADR-004 (evidence grounding) |
| Related ACs | AC-S007 |
| Research basis | `docs/00_research_2026_04.md` §"Sprint-6 ground-segment research (2026-07-02)" — CelesTrak GP, 3GPP NTN elevation convention, SRSP NP-completeness, KSAT human-in-the-loop |

## 1. Goal

Turn OrbitOps' closed-loop dry-run from an illustrative mock into a **real, demonstrable** ground-segment capability: ingest **real orbital data (TLE/OMM)**, compute **real satellite–ground-station contact windows**, and produce a **conflict-free contact schedule** across a multi-station, multi-antenna network — with the copilot able to explain each decision and every mutation gated by human-approved dry-run (SPEC-S006-VS21). This is the RunSpace-2026 finals kernel that makes the pitch's "real TLE scheduling" claim true, not aspirational.

## 2. Non-goals

- **No real RF/SDR/antenna control** (P2). This computes *when* contacts are possible and *how* to allocate antennas; it does not command hardware.
- **No live Space-Track polling in tests** — a bundled offline TLE sample keeps tests deterministic and network-free.
- **No autonomous apply** — schedule changes follow the SPEC-S006-VS21 dry-run → human-approval → GitOps path; the scheduler never mutates a cluster or a live ground network.
- **No optimality guarantee** — the Satellite Range Scheduling Problem is NP-complete; the PoC uses a documented greedy (priority + earliest-AOS) heuristic, not an exact solver.

## 3. Inputs

- **Satellites**: TLE/OMM element sets (bundled `data/sample_tles.txt` — 7 real satellites incl. ISS, CSS, NOAA-20/21, Landsat-8/9, Sentinel-2A, fetched from CelesTrak via `CATNR=…&FORMAT=tle`). Live fetch is optional and out of the test path.
- **Ground stations**: `GroundStation(name, lat_deg, lon_deg, elevation_m, antennas)`. Demo uses verified real coordinates (KSAT SvalSat, NASA ASF Fairbanks, KSAT TrollSat, and the TASA HQ/SOCC area in Hsinchu — the last explicitly a park-level, not antenna-precise, coordinate).
- **Parameters**: time horizon `[start, end]`, `min_elevation_deg` (default **10°**, the 3GPP NTN service-link convention), per-satellite `priority`.

## 4. Outputs

- `ContactWindow(satellite, station, aos, los, max_elevation_deg)` (+ `duration_s`) — one per rise→set above the elevation mask.
- `ScheduleResult(scheduled: [ScheduledContact(window, antenna)], rejected: [ContactWindow], metrics)`.
- `metrics`: `n_windows`, `n_scheduled`, `n_rejected`, `scheduled_contact_minutes`, per-station `utilization` (busy / (antennas × horizon)).

## 5. Interfaces

- `contacts.load_tles(path) -> list[EarthSatellite]`
- `contacts.compute_contacts(satellites, stations, start, end, min_elevation_deg=10.0) -> list[ContactWindow]` — uses skyfield `satellite.find_events(topos, t0, t1, altitude_degrees=…)` (rise=0 / culminate=1 / set=2).
- `scheduler.schedule(windows, antennas=None, priority=None, horizon=None) -> ScheduleResult` — greedy, conflict-resolving.
- `cli.run_demo() -> ScheduleResult` + `python -m ground_scheduler.cli` (human-readable schedule + metrics).
- **Future (Sprint-6+)**: `POST /schedule/dry-run` on copilot-api returning the proposed schedule diff as a SPEC-S006-VS21 dry-run action (reuses `/action/dry-run` shape); never an apply route without ADR-013 human-approval + audit.

## 6. Constraints

- **Real data, honest boundary**: real public TLE (CelesTrak/Space-Track). P0 = a pre-field **rehearsal/validation** kernel; P2 = live RF/RAN. Never claim real beam-steering (CLAUDE.md §2.2).
- **Elevation mask 10°** default (3GPP NTN convention; FCC mandates ≥5°). Configurable.
- **Human-in-the-loop**: schedule mutations go via dry-run → approval → GitOps; never auto-apply (KSAT operational norm: "very careful about automated response" for mission-critical ops).
- **Determinism**: tests pin a fixed window anchored to the sample's TLE epoch; no `utcnow()` in the tested path.
- **CelesTrak fetch**: always pass `&FORMAT=tle` (CelesTrak's default silently changed to CSV on 2026-05-09); cache client-side (GP data refreshes every 2h).
- **Chain #6 (no partial migration)**: window computation + scheduling + metrics ship together; the demo covers ≥3 stations and a multi-inclination satellite set.

## 7. Open questions (Sprint-6)

1. Exact solver upgrade: greedy → ILP/CP-SAT or RL for larger constellations (SRSP is NP-complete; benchmark before productizing).
2. Antenna slew/setup-time gaps and frequency-band constraints (currently instantaneous antenna reuse).
3. Live TLE refresh + OMM (JSON) migration ahead of the 5→6-digit NORAD catalog exhaustion (~July 2026).
4. TASA ground-station real coordinates (Zhongli/Tainan) — obtain via NCC earth-station licence filings before any non-demo use.
5. Wiring the schedule as a first-class SPEC-S006-VS21 safe action (`reschedule_contact`) with an inverse + audit.

## 8. Acceptance criteria

See `docs/acceptance/AC-S007-ground-contact-scheduling.md`.

## 9. Sources

CelesTrak GP data formats & `FORMAT` default change (fetched 2026-07-02); 3GPP NTN service-link elevation convention (TR 38.811 lineage; corroborated); Satellite Range Scheduling Problem NP-completeness — *Autonomous Intelligent Systems*, Springer (2023); KSAT SvalSat / human-in-the-loop (Dec 2025); Novaspace/SIA ground-segment market (2025–2026). Station coordinates verified against ≥2 independent sources where possible; TASA antenna sites flagged as not publicly geolocated.
