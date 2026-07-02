"""Deterministic tests for the greedy conflict-resolving scheduler.

No skyfield here on purpose — ContactWindow instances are built by hand
so these tests run instantly and pin down scheduler *policy* (antenna
conflicts, priority ordering, utilization math) independent of orbital
mechanics. See test_contacts.py for the real-TLE geometry tests.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ground_scheduler.models import ContactWindow
from ground_scheduler.scheduler import schedule

BASE = datetime(2026, 7, 1, 12, 0, 0, tzinfo=timezone.utc)


def _window(
    satellite: str,
    station: str,
    aos_offset_s: float,
    duration_s: float,
    max_elevation_deg: float = 45.0,
) -> ContactWindow:
    aos = BASE + timedelta(seconds=aos_offset_s)
    los = aos + timedelta(seconds=duration_s)
    return ContactWindow(
        satellite=satellite,
        station=station,
        aos=aos,
        los=los,
        max_elevation_deg=max_elevation_deg,
    )


def test_overlapping_windows_single_antenna_one_rejected() -> None:
    w1 = _window("SAT-A", "STATION-A", aos_offset_s=0, duration_s=300)
    w2 = _window("SAT-B", "STATION-A", aos_offset_s=120, duration_s=300)  # overlaps w1

    result = schedule([w1, w2])

    assert len(result.scheduled) == 1
    assert len(result.rejected) == 1
    assert result.metrics["n_windows"] == 2
    assert result.metrics["n_scheduled"] == 1
    assert result.metrics["n_rejected"] == 1
    # earlier AOS wins when priorities are equal (both default to 0)
    assert result.scheduled[0].window.satellite == "SAT-A"
    assert result.rejected[0].satellite == "SAT-B"


def test_overlapping_windows_two_antennas_both_scheduled() -> None:
    w1 = _window("SAT-A", "STATION-A", aos_offset_s=0, duration_s=300)
    w2 = _window("SAT-B", "STATION-A", aos_offset_s=120, duration_s=300)

    result = schedule([w1, w2], antennas={"STATION-A": 2})

    assert len(result.scheduled) == 2
    assert len(result.rejected) == 0
    assert result.metrics["n_scheduled"] == 2
    assert result.metrics["n_rejected"] == 0
    # each contact lands on a distinct antenna
    assert {sc.antenna for sc in result.scheduled} == {1, 2}


def test_non_overlapping_windows_single_antenna_both_scheduled() -> None:
    w1 = _window("SAT-A", "STATION-A", aos_offset_s=0, duration_s=300)
    w2 = _window("SAT-B", "STATION-A", aos_offset_s=600, duration_s=300)  # starts after w1 ends

    result = schedule([w1, w2])

    assert len(result.scheduled) == 2
    assert len(result.rejected) == 0
    # both share the single antenna, sequentially
    assert {sc.antenna for sc in result.scheduled} == {1}


def test_scheduled_plus_rejected_equals_total_and_utilization_bounded() -> None:
    horizon = (BASE, BASE + timedelta(hours=1))

    windows = [
        _window("SAT-A", "STATION-A", aos_offset_s=0, duration_s=300),
        _window("SAT-B", "STATION-A", aos_offset_s=600, duration_s=300),
        _window("SAT-C", "STATION-B", aos_offset_s=0, duration_s=1800),
        _window("SAT-D", "STATION-B", aos_offset_s=900, duration_s=1800),  # conflicts w/ SAT-C
    ]

    result = schedule(windows, antennas={"STATION-B": 1}, horizon=horizon)

    assert (
        result.metrics["n_scheduled"] + result.metrics["n_rejected"] == result.metrics["n_windows"]
    )
    assert result.metrics["n_windows"] == len(windows)

    utilization = result.metrics["utilization"]
    assert set(utilization) == {"STATION-A", "STATION-B"}
    for value in utilization.values():
        assert 0.0 <= value <= 1.0


def test_scheduled_plus_rejected_equals_total_invariant_holds_generally() -> None:
    """Same invariant, different shape of input — no horizon this time."""
    windows = [
        _window("SAT-A", "STATION-A", aos_offset_s=0, duration_s=120),
        _window("SAT-B", "STATION-A", aos_offset_s=60, duration_s=120),
        _window("SAT-C", "STATION-A", aos_offset_s=90, duration_s=120),
        _window("SAT-D", "STATION-B", aos_offset_s=0, duration_s=60),
    ]

    result = schedule(windows, antennas={"STATION-A": 2})

    assert (
        result.metrics["n_scheduled"] + result.metrics["n_rejected"] == result.metrics["n_windows"]
    )
    assert result.metrics["n_windows"] == len(windows)


def test_higher_priority_later_aos_window_wins_conflict() -> None:
    """A later-AOS, higher-priority window must be considered before an
    earlier-AOS, lower-priority window when they conflict for the same
    single antenna — verifying priority reorders the greedy assignment,
    not just AOS order."""
    w_low = _window("SAT-LOW", "STATION-A", aos_offset_s=0, duration_s=600, max_elevation_deg=10)
    w_high = _window(
        "SAT-HIGH", "STATION-A", aos_offset_s=300, duration_s=600, max_elevation_deg=80
    )  # later AOS, overlaps w_low

    result = schedule([w_low, w_high], priority={"SAT-HIGH": 10})

    assert len(result.scheduled) == 1
    assert result.scheduled[0].window.satellite == "SAT-HIGH"
    assert len(result.rejected) == 1
    assert result.rejected[0].satellite == "SAT-LOW"

    # sanity check: without priority, AOS order alone would favor SAT-LOW
    result_no_priority = schedule([w_low, w_high])
    assert result_no_priority.scheduled[0].window.satellite == "SAT-LOW"
    assert result_no_priority.rejected[0].satellite == "SAT-HIGH"
