"""Pure-function metrics computation.

Given a v2 scenario dict and current simulated time `t`, produce per-beam /
per-gateway / per-anomaly-type metric values per `docs/contracts/metrics.md`.

No randomness in Sprint 1: output is a pure function of (scenario, t).
"""

from __future__ import annotations

from typing import Any

EVENT_TYPES: tuple[str, ...] = (
    "snr_drop",
    "handover_failure",
    "doppler_spike",
    "gateway_outage",
    "packet_loss_spike",
)

DEFAULT_GATEWAY_ID = "gateway-default"

# State machine numeric encoding for orbitops_handover_state:
HO_STATE_STABLE = 0.0
HO_STATE_PREPARING = 1.0
HO_STATE_FAILURE = 2.0


def gateway_ids(scenario: dict[str, Any]) -> list[str]:
    """Extract gateway ids referenced by gateway_outage events; fall back to default."""
    ids: list[str] = []
    seen: set[str] = set()
    for ev in scenario.get("events", []):
        if ev.get("type") == "gateway_outage":
            target = ev.get("target")
            if target and target not in seen:
                seen.add(target)
                ids.append(target)
    if not ids:
        ids = [DEFAULT_GATEWAY_ID]
    return ids


def _is_active(event: dict[str, Any], t: int) -> bool:
    start = event["t_offset_seconds"]
    end = start + event["duration_seconds"]
    return start <= t < end


def _active_events(scenario: dict[str, Any], t: int) -> list[dict[str, Any]]:
    return [ev for ev in scenario.get("events", []) if _is_active(ev, t)]


def _baseline_snr_db(beam: dict[str, Any]) -> float:
    el = float(beam.get("boresight_el_deg", 45.0))
    return 8.0 + el / 10.0


def compute(scenario: dict[str, Any], t: int) -> dict[str, list[tuple[dict[str, str], float]]]:
    """Return mapping metric-name → list[(labels, value)]."""
    active = _active_events(scenario, t)

    snr: list[tuple[dict[str, str], float]] = []
    sinr: list[tuple[dict[str, str], float]] = []
    latency: list[tuple[dict[str, str], float]] = []
    loss: list[tuple[dict[str, str], float]] = []
    doppler: list[tuple[dict[str, str], float]] = []
    ho_state: list[tuple[dict[str, str], float]] = []

    any_gateway_outage_active = any(ev["type"] == "gateway_outage" for ev in active)

    for beam in scenario["beams"]:
        beam_id = beam["beam_id"]
        labels = {"beam_id": beam_id}

        beam_active = [ev for ev in active if ev.get("target") == beam_id]

        snr_drop_total = sum(
            float(ev.get("magnitude_db", 0.0)) for ev in beam_active if ev["type"] == "snr_drop"
        )
        beam_snr = _baseline_snr_db(beam) - snr_drop_total
        snr.append((labels, beam_snr))
        sinr.append((labels, beam_snr - 2.0))

        beam_handover_or_outage_active = (
            any(ev["type"] == "handover_failure" for ev in beam_active)
            or any_gateway_outage_active
        )
        beam_latency = 25.0 + (50.0 if beam_handover_or_outage_active else 0.0)
        latency.append((labels, beam_latency))

        loss_spike = any(ev["type"] == "packet_loss_spike" for ev in beam_active)
        beam_loss = 0.001 + (0.3 if loss_spike else 0.0)
        beam_loss = min(beam_loss, 0.5)
        loss.append((labels, beam_loss))

        doppler_total = sum(
            float(ev.get("magnitude_hz", 0.0)) for ev in beam_active if ev["type"] == "doppler_spike"
        )
        doppler.append((labels, doppler_total))

        if any(ev["type"] == "handover_failure" for ev in beam_active):
            ho_state.append((labels, HO_STATE_FAILURE))
        else:
            ho_state.append((labels, HO_STATE_STABLE))

    gw_avail: list[tuple[dict[str, str], float]] = []
    gw_outage_targets = {
        ev["target"] for ev in active if ev["type"] == "gateway_outage"
    }
    for gw_id in gateway_ids(scenario):
        gw_avail.append(
            ({"gateway_id": gw_id}, 0.0 if gw_id in gw_outage_targets else 1.0)
        )

    anomaly_active: list[tuple[dict[str, str], float]] = []
    active_types = {ev["type"] for ev in active}
    for et in EVENT_TYPES:
        anomaly_active.append(({"type": et}, 1.0 if et in active_types else 0.0))

    return {
        "orbitops_beam_snr_db": snr,
        "orbitops_beam_sinr_db": sinr,
        "orbitops_link_latency_ms": latency,
        "orbitops_packet_loss_ratio": loss,
        "orbitops_doppler_residual_hz": doppler,
        "orbitops_handover_state": ho_state,
        "orbitops_gateway_available": gw_avail,
        "orbitops_anomaly_active": anomaly_active,
    }


def active_anomaly_types(scenario: dict[str, Any], t: int) -> list[str]:
    return sorted({ev["type"] for ev in _active_events(scenario, t)})
