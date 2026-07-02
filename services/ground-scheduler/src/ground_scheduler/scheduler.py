"""Greedy conflict-resolving contact scheduler.

Turns a flat list of ``ContactWindow`` (computed by ``contacts.py``) into
a ``ScheduleResult``: which windows got an antenna assigned, which were
rejected for lack of a free antenna, and summary metrics. This is the
"contact windows -> schedule" half of the RunSpace-2026 finals kernel.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from .models import ContactWindow, ScheduledContact, ScheduleResult

logger = logging.getLogger(__name__)


def schedule(
    windows: list[ContactWindow],
    antennas: dict[str, int] | None = None,
    priority: dict[str, int] | None = None,
    horizon: tuple[datetime, datetime] | None = None,
) -> ScheduleResult:
    """Greedily assign contact windows to station antennas.

    Windows are considered in order of (highest priority first, then
    earliest AOS). For each window, the first antenna at its station
    that is free at ``w.aos`` (never used, or free-time <= w.aos) is
    assigned; the antenna's free-time then becomes ``w.los``. A window
    with no free antenna at its station is rejected (a genuine
    scheduling conflict — not a bug, and reported in ``metrics``).

    ``antennas`` maps station name -> antenna count (default 1 for any
    station not present). ``priority`` maps satellite name -> integer
    priority (default 0; higher wins). ``horizon`` is an optional
    ``(start, end)`` tz-aware window used to compute per-station
    antenna utilization.
    """
    antennas = antennas or {}
    priority = priority or {}

    ordered = sorted(windows, key=lambda w: (-priority.get(w.satellite, 0), w.aos))

    # Per-station list of each antenna's next-free time (None = never used).
    # List index is 0-based internally; reported ScheduledContact.antenna is
    # 1-based (antenna IDs are human-facing, e.g. "Svalbard-NO antenna 2").
    antenna_free_at: dict[str, list[datetime | None]] = {}

    scheduled: list[ScheduledContact] = []
    rejected: list[ContactWindow] = []

    for w in ordered:
        free_list = antenna_free_at.setdefault(w.station, [None] * antennas.get(w.station, 1))

        assigned_idx: int | None = None
        for idx, free_at in enumerate(free_list):
            if free_at is None or free_at <= w.aos:
                assigned_idx = idx
                break

        if assigned_idx is None:
            rejected.append(w)
            logger.debug(
                "schedule.conflict",
                extra={"satellite": w.satellite, "station": w.station, "aos": w.aos.isoformat()},
            )
            continue

        free_list[assigned_idx] = w.los
        scheduled.append(ScheduledContact(window=w, antenna=assigned_idx + 1))

    n_windows = len(windows)
    n_scheduled = len(scheduled)
    n_rejected = len(rejected)
    scheduled_contact_minutes = round(sum(sc.window.duration_s for sc in scheduled) / 60.0, 1)

    metrics: dict[str, Any] = {
        "n_windows": n_windows,
        "n_scheduled": n_scheduled,
        "n_rejected": n_rejected,
        "scheduled_contact_minutes": scheduled_contact_minutes,
    }

    if horizon is not None:
        h_start, h_end = horizon
        horizon_seconds = (h_end - h_start).total_seconds()

        busy_seconds: dict[str, float] = {}
        for sc in scheduled:
            busy_seconds[sc.window.station] = (
                busy_seconds.get(sc.window.station, 0.0) + sc.window.duration_s
            )

        stations = set(antennas) | {w.station for w in windows}
        utilization: dict[str, float] = {}
        for station in stations:
            n_antennas = antennas.get(station, 1)
            capacity = n_antennas * horizon_seconds
            util = busy_seconds.get(station, 0.0) / capacity if capacity > 0 else 0.0
            utilization[station] = round(util, 3)
        metrics["utilization"] = utilization

    logger.info("schedule.done", extra={k: v for k, v in metrics.items() if k != "utilization"})

    return ScheduleResult(scheduled=scheduled, rejected=rejected, metrics=metrics)
