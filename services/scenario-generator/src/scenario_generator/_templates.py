"""Scenario builder functions.

Each builder takes a seeded ``random.Random`` and returns a dict satisfying
``tests/contracts/scenario.schema.json``. AC-001 invariants for
``beam-degradation`` (scenario_id, snr_drop on beam-1 at t=60s, 6 dB, 90 s)
are HARD-CODED and DO NOT vary on seed.
"""

from __future__ import annotations

import random
from typing import Any, Callable

ScenarioBuilder = Callable[[random.Random], dict[str, Any]]


def _build_beam_degradation(rng: random.Random) -> dict[str, Any]:  # noqa: ARG001
    return {
        "scenario_id": "beam-degradation-001",
        "start_time": "2026-04-30T12:00:00Z",
        "duration_seconds": 600,
        "satellite_id": "b5g-1a",
        "ground_station_id": "gs-tw-01",
        "beams": [
            {"beam_id": "beam-1", "boresight_az_deg": 120.0, "boresight_el_deg": 45.0, "hpbw_deg": 3.5},
            {"beam_id": "beam-2", "boresight_az_deg": 150.0, "boresight_el_deg": 50.0, "hpbw_deg": 3.5},
            {"beam_id": "beam-3", "boresight_az_deg": 180.0, "boresight_el_deg": 35.0, "hpbw_deg": 3.5},
        ],
        "events": [
            {
                "t_offset_seconds": 60,
                "type": "snr_drop",
                "target": "beam-1",
                "duration_seconds": 90,
                "magnitude_db": 6.0,
            },
        ],
        "expected_anomaly": {
            "type": "snr_drop",
            "target": "beam-1",
            "keywords": ["beam-1", "snr", "degrad", "elevation"],
        },
    }


def _build_handover_failure(rng: random.Random) -> dict[str, Any]:  # noqa: ARG001
    return {
        "scenario_id": "handover-failure-001",
        "start_time": "2026-04-30T13:00:00Z",
        "duration_seconds": 600,
        "satellite_id": "b5g-1a",
        "ground_station_id": "gs-tw-01",
        "beams": [
            {"beam_id": "beam-1", "boresight_az_deg": 110.0, "boresight_el_deg": 40.0, "hpbw_deg": 3.5},
            {"beam_id": "beam-2", "boresight_az_deg": 140.0, "boresight_el_deg": 55.0, "hpbw_deg": 3.5},
            {"beam_id": "beam-3", "boresight_az_deg": 170.0, "boresight_el_deg": 30.0, "hpbw_deg": 3.5},
        ],
        "events": [
            {
                "t_offset_seconds": 90,
                "type": "handover_failure",
                "target": "beam-1",
                "duration_seconds": 60,
            },
            {
                "t_offset_seconds": 90,
                "type": "doppler_spike",
                "target": "beam-1",
                "duration_seconds": 30,
                "magnitude_hz": 1500.0,
            },
        ],
        "expected_anomaly": {
            "type": "handover_failure",
            "target": "beam-1",
            "keywords": ["handover", "beam-1", "beam-2", "doppler", "fallback"],
        },
    }


def _build_gateway_fallback(rng: random.Random) -> dict[str, Any]:  # noqa: ARG001
    return {
        "scenario_id": "gateway-fallback-001",
        "start_time": "2026-04-30T14:00:00Z",
        "duration_seconds": 600,
        "satellite_id": "b5g-1a",
        "ground_station_id": "gs-tw-01",
        "beams": [
            {"beam_id": "beam-1", "boresight_az_deg": 120.0, "boresight_el_deg": 45.0, "hpbw_deg": 3.5},
            {"beam_id": "beam-2", "boresight_az_deg": 150.0, "boresight_el_deg": 50.0, "hpbw_deg": 3.5},
        ],
        "events": [
            {
                "t_offset_seconds": 30,
                "type": "gateway_outage",
                "target": "gateway-pod-1",
                "duration_seconds": 120,
            },
            {
                "t_offset_seconds": 30,
                "type": "packet_loss_spike",
                "target": "beam-1",
                "duration_seconds": 60,
            },
        ],
        "expected_anomaly": {
            "type": "gateway_outage",
            "target": "gateway-pod-1",
            "keywords": ["gateway", "fallback", "pod_health", "failover"],
        },
    }


TEMPLATE_BUILDERS: dict[str, ScenarioBuilder] = {
    "beam-degradation": _build_beam_degradation,
    "handover-failure": _build_handover_failure,
    "gateway-fallback": _build_gateway_fallback,
}
