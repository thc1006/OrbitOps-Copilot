# ground-scheduler

Real-TLE contact-scheduling PoC: real orbital data (offline TLE sample) →
skyfield-computed AOS/LOS contact windows for a set of ground stations →
a greedy, priority-aware, antenna-conflict-resolving schedule. This is
the **RunSpace-2026 finals deliverable** for OrbitOps — the piece that
turns "we have metrics and a copilot" into "we can actually plan which
satellite talks to which antenna, and when, without double-booking a
dish."

## Why

Ground-station operators juggle a genuinely hard combinatorial problem:
many satellites, few antennas, overlapping visibility windows, and
priority passes (e.g. a payload downlink) that must preempt routine
telemetry contacts. `ground-scheduler` demonstrates the whole pipeline
on **real** orbital mechanics — an actual public TLE set (ISS + 5 other
LEO objects, epoch ~2026-07-01) propagated with `skyfield`'s SGP4 — not
a synthetic stand-in.

## Honest boundary note (P0/P2 discipline, per `CLAUDE.md`)

This is a **PoC on real, but offline/bundled, public TLE data**. It is:

- a pre-field rehearsal / validation kernel for schedule logic — real
  orbital geometry, real conflict resolution, real metrics;
- **not** a live ground-station integration: no live TLE fetch (e.g.
  Space-Track/CelesTrak API), no antenna control system, no real-time
  telemetry feed, no cluster mutation of any kind.

Per `CLAUDE.md` §9/§10 (P0 scope / forbidden scope), this stays firmly
in the "digital twin / operations rehearsal" lane. Wiring a live TLE
feed or an actual antenna controller is explicitly out of scope for
this milestone and would be a P2+ integration, not a PoC extension.

## Run

```bash
cd services/ground-scheduler
PYTHONPATH=src python3 -m ground_scheduler.cli
```

This loads the bundled sample TLEs (`data/sample_tles.txt`), computes
contact windows against three demo ground stations (Hsinchu-TW,
Svalbard-NO with 2 antennas, Fairbanks-US) over a 6-hour window
starting at the TLE epoch, schedules them (ISS given priority), and
prints a readable schedule table plus scheduling metrics. It performs
a dry run only — no cluster or external system is touched.

## Test

```bash
pytest services/ground-scheduler/tests -q
```

- `test_scheduler.py` — deterministic scheduler-policy tests (antenna
  conflicts, priority ordering, utilization math); no skyfield involved.
- `test_contacts.py` — real-TLE, real-skyfield contact-window geometry,
  asserted via invariants (not brittle exact counts) over a fixed
  window for determinism.
- `test_cli_smoke.py` — end-to-end smoke test of `run_demo()`.
