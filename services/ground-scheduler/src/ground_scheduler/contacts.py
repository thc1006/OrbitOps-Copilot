"""Real-TLE contact-window computation.

Loads TLEs (3-line format: name / line1 / line2) and computes AOS/LOS
visibility windows for a set of ground stations using Skyfield's
``EarthSatellite.find_events`` rise/culminate/set search. This is the
"real orbital data -> contact windows" half of the RunSpace-2026 finals
kernel; see ``scheduler.py`` for the conflict-resolving half.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from skyfield.api import EarthSatellite, load, wgs84

from .models import ContactWindow, GroundStation

logger = logging.getLogger(__name__)

# Module-level timescale: Skyfield's timescale carries leap-second / delta-T
# tables that are expensive to (re)build, and satellites created against one
# timescale should be evaluated against times built from that same instance.
ts = load.timescale()

_RISE = 0
_CULMINATE = 1
_SET = 2


def load_tles(path: str | Path) -> list[EarthSatellite]:
    """Parse a 3-line-per-satellite TLE file into ``EarthSatellite`` objects.

    Malformed groups (line1 not starting with "1 " or line2 not starting
    with "2 ") are skipped with a warning rather than raising, so one bad
    entry in a bundled sample file doesn't take down the whole load.
    """
    text = Path(path).read_text(encoding="utf-8")
    lines = [line for line in text.splitlines() if line.strip() != ""]

    satellites: list[EarthSatellite] = []
    for i in range(0, len(lines), 3):
        group = lines[i : i + 3]
        if len(group) != 3:
            logger.warning("tle.group_truncated", extra={"path": str(path), "start_line": i})
            continue
        name, line1, line2 = group
        if not line1.startswith("1 ") or not line2.startswith("2 "):
            logger.warning(
                "tle.group_malformed",
                extra={"path": str(path), "name": name.strip()},
            )
            continue
        satellites.append(EarthSatellite(line1, line2, name.strip(), ts))

    logger.info("tle.loaded", extra={"path": str(path), "count": len(satellites)})
    return satellites


def compute_contacts(
    satellites: list[EarthSatellite],
    stations: list[GroundStation],
    start: datetime,
    end: datetime,
    min_elevation_deg: float = 10.0,
) -> list[ContactWindow]:
    """Compute AOS->LOS contact windows for every (satellite, station) pair.

    ``start``/``end`` must be tz-aware UTC datetimes. Uses
    ``EarthSatellite.find_events`` (rise=0, culminate=1, set=2). Each
    rise is paired with the next set to form a window; the highest
    elevation observed at any culmination between them is recorded as
    ``max_elevation_deg``. A set event with no preceding rise (the pass
    was already above the elevation mask when the search window opened)
    is ignored, since we have no AOS to pair it with.
    """
    t0 = ts.from_datetime(start)
    t1 = ts.from_datetime(end)

    windows: list[ContactWindow] = []
    for sat in satellites:
        for station in stations:
            topos = wgs84.latlon(station.lat_deg, station.lon_deg, station.elevation_m)
            times, events = sat.find_events(topos, t0, t1, altitude_degrees=min_elevation_deg)

            pending_aos: datetime | None = None
            pending_max_elev: float | None = None
            for ti, event in zip(times, events):
                if event == _RISE:
                    pending_aos = ti.utc_datetime()
                    pending_max_elev = None
                elif event == _CULMINATE:
                    if pending_aos is None:
                        # Culminated without a rise in-window: satellite was
                        # already up when the search started. No AOS to
                        # anchor a window on, so there is nothing to update.
                        continue
                    _alt, _az, _dist = (sat - topos).at(ti).altaz()
                    elev = _alt.degrees
                    if pending_max_elev is None or elev > pending_max_elev:
                        pending_max_elev = elev
                elif event == _SET:
                    if pending_aos is None:
                        logger.debug(
                            "contact.unpaired_set_ignored",
                            extra={"satellite": sat.name, "station": station.name},
                        )
                        continue
                    windows.append(
                        ContactWindow(
                            satellite=sat.name,
                            station=station.name,
                            aos=pending_aos,
                            los=ti.utc_datetime(),
                            max_elevation_deg=pending_max_elev
                            if pending_max_elev is not None
                            else min_elevation_deg,
                        )
                    )
                    pending_aos = None
                    pending_max_elev = None

    windows.sort(key=lambda w: (w.aos, w.station))
    logger.info(
        "contacts.computed",
        extra={
            "n_satellites": len(satellites),
            "n_stations": len(stations),
            "n_windows": len(windows),
        },
    )
    return windows
