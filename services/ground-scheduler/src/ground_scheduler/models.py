"""Domain types for ground-scheduler.

First-class dataclasses (per OrbitOps CLAUDE.md §3 — "Domain types are
first-class"), not string-keyed dicts. Frozen because these represent
immutable facts about orbital geometry (``ContactWindow``) or fixed
scheduling inputs/outputs (``GroundStation``, ``ScheduledContact``,
``ScheduleResult``).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class GroundStation:
    """A ground station capable of tracking one satellite per antenna."""

    name: str
    lat_deg: float
    lon_deg: float
    elevation_m: float = 0.0
    antennas: int = 1


@dataclass(frozen=True)
class ContactWindow:
    """A single AOS→LOS visibility window for one satellite at one station."""

    satellite: str
    station: str
    aos: datetime
    los: datetime
    max_elevation_deg: float

    @property
    def duration_s(self) -> float:
        return (self.los - self.aos).total_seconds()


@dataclass(frozen=True)
class ScheduledContact:
    """A ``ContactWindow`` assigned to a specific antenna at its station."""

    window: ContactWindow
    antenna: int


@dataclass(frozen=True)
class ScheduleResult:
    """Output of the greedy scheduler: what got scheduled, what was
    rejected due to antenna conflicts, and summary metrics."""

    scheduled: list[ScheduledContact] = field(default_factory=list)
    rejected: list[ContactWindow] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
