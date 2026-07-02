"""Real-TLE contact-window tests.

Uses the bundled offline sample (`data/sample_tles.txt`, ~2026-07-01
epoch, 7 satellites: ISS/CSS + polar SSO NOAA-20/21, Landsat-8/9,
Sentinel-2A) and skyfield's real SGP4 propagation +
rise/culminate/set search. A FIXED 12-hour window anchored to the first
satellite's TLE epoch keeps this deterministic (no `utcnow()`).

Assertions are invariants, not exact counts — pass geometry is real
orbital mechanics and shouldn't be pinned to a brittle magic number.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from ground_scheduler.contacts import compute_contacts, load_tles
from ground_scheduler.models import GroundStation

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "sample_tles.txt"

STATIONS = [
    GroundStation(name="Hsinchu-TW", lat_deg=24.79, lon_deg=120.99, elevation_m=0.0),
    GroundStation(name="Svalbard-NO", lat_deg=78.23, lon_deg=15.39, elevation_m=0.0, antennas=2),
    GroundStation(name="Fairbanks-US", lat_deg=64.86, lon_deg=-147.85, elevation_m=135.0),
]


def test_load_tles_returns_at_least_five_satellites() -> None:
    satellites = load_tles(DATA_PATH)
    assert len(satellites) >= 5
    names = {sat.name for sat in satellites}
    assert "ISS (ZARYA)" in names


def test_compute_contacts_over_fixed_window_invariants() -> None:
    satellites = load_tles(DATA_PATH)
    start = satellites[0].epoch.utc_datetime()
    end = start + timedelta(hours=12)

    windows = compute_contacts(satellites, STATIONS, start, end, min_elevation_deg=10.0)

    assert len(windows) >= 1, "expected at least one contact window over 12h / 3 stations / 7 sats"

    for w in windows:
        assert w.aos < w.los
        assert 0.0 < w.duration_s < 1800.0, f"LEO pass duration out of range: {w.duration_s}s"
        assert 10.0 <= w.max_elevation_deg <= 90.5, f"elevation out of range: {w.max_elevation_deg}"

    aoses = [w.aos for w in windows]
    assert aoses == sorted(aoses), "windows must be sorted by AOS"
