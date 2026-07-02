"""Demo CLI: real TLE -> contact windows -> conflict-resolved schedule.

Run with::

    python -m ground_scheduler.cli

This is a dry-run demo only: it reads the bundled offline TLE sample and
prints a schedule table + metrics. It never talks to a cluster, a real
ground station, or any network service — see ``README.md`` for the full
boundary note.

``print`` is used here (not ``logging``) because this module's whole
purpose is human-readable stdout output; library code (``contacts.py``,
``scheduler.py``) uses ``logging`` exclusively, per repo convention.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from .contacts import compute_contacts, load_tles
from .models import GroundStation, ScheduleResult
from .scheduler import schedule

_BUNDLED_TLE_PATH = Path(__file__).parents[2] / "data" / "sample_tles.txt"

# Verified real ground-station coordinates (WGS84 decimal degrees). The Taiwan
# entry is the TASA HQ / SOCC area in Hsinchu Science Park — a public, park-level
# coordinate; TASA's exact TT&C antenna sites (Zhongli, Tainan) are NOT publicly
# geolocated, so no antenna-level precision is claimed. Svalbard = KSAT SvalSat,
# Fairbanks = NASA ASF (elevation approximate), TrollSat = KSAT Troll (Antarctica).
_STATIONS = [
    GroundStation(
        name="Hsinchu-TW", lat_deg=24.7800, lon_deg=121.0136, elevation_m=30.0, antennas=1
    ),
    GroundStation(
        name="Svalbard-NO", lat_deg=78.2298, lon_deg=15.4078, elevation_m=450.0, antennas=2
    ),
    GroundStation(
        name="Fairbanks-US", lat_deg=64.7940, lon_deg=-147.5360, elevation_m=130.0, antennas=1
    ),
    GroundStation(
        name="TrollSat-AQ", lat_deg=-72.0167, lon_deg=2.5333, elevation_m=1270.0, antennas=1
    ),
]

_MIN_ELEVATION_DEG = 10.0  # 3GPP NTN service-link convention
_PRIORITY = {"ISS (ZARYA)": 10, "NOAA 20 (JPSS-1)": 8, "NOAA 21 (JPSS-2)": 8}


def run_demo(tle_path: Path | None = None) -> ScheduleResult:
    """Run the end-to-end demo pipeline and return the ``ScheduleResult``.

    Factored out of ``main()`` so tests can exercise the real pipeline
    (real TLE parse + real skyfield geometry + real greedy scheduling)
    without shelling out to the CLI.
    """
    path = tle_path if tle_path is not None else _BUNDLED_TLE_PATH
    satellites = load_tles(path)

    start = satellites[0].epoch.utc_datetime().replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=6)

    windows = compute_contacts(
        satellites, _STATIONS, start, end, min_elevation_deg=_MIN_ELEVATION_DEG
    )

    antennas = {station.name: station.antennas for station in _STATIONS}
    result = schedule(windows, antennas=antennas, priority=_PRIORITY, horizon=(start, end))
    return result


def _print_schedule_table(result: ScheduleResult) -> None:
    header = (
        f"{'SATELLITE':<18}{'STATION':<14}{'AOS (UTC)':<21}{'DUR(min)':>9}{'MAX EL':>9}{'ANT':>5}"
    )
    print(header)
    print("-" * len(header))
    for sc in sorted(result.scheduled, key=lambda s: s.window.aos):
        w = sc.window
        print(
            f"{w.satellite:<18}{w.station:<14}"
            f"{w.aos.strftime('%Y-%m-%d %H:%M:%S'):<21}"
            f"{w.duration_s / 60.0:>9.1f}"
            f"{w.max_elevation_deg:>9.1f}"
            f"{sc.antenna:>5}"
        )


def main() -> None:
    print(f"ground-scheduler demo — bundled TLE: {_BUNDLED_TLE_PATH}")
    result = run_demo()

    print()
    print("Schedule:")
    _print_schedule_table(result)

    print()
    print("Metrics:")
    for key, value in result.metrics.items():
        print(f"  {key}: {value}")

    print()
    print(
        f"dry-run: {result.metrics['n_scheduled']} contacts scheduled, "
        f"{result.metrics['n_rejected']} conflicts resolved — no cluster mutation"
    )


if __name__ == "__main__":
    main()
