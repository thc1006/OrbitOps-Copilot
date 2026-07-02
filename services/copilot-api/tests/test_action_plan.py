"""SPEC-S006-VS21 AC-B1 (VS-23) — /runbook emits a grounded action_plan.

The action_plan points at a whitelisted safe action (SPEC §5.1) fitting the
detected anomaly, so the UI can preview its dry-run. Grounding invariant
(ADR-004): an action is NEVER recommended without evidence — an INSUFFICIENT
response carries action_plan = None.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from copilot_api.main import app

    return TestClient(app)


def _snr_drop_metric_snapshot() -> list[dict]:
    return [
        {
            "name": "orbitops_beam_snr_db",
            "labels": {"beam_id": "beam-1"},
            "value": 6.5,
            "timestamp": "2026-04-30T12:01:30Z",
        }
    ]


# ---------------------------------------------------------------------------
# recommend_action mapping (unit)
# ---------------------------------------------------------------------------


def test_recommend_action_maps_known_anomalies() -> None:
    from copilot_api._actions import recommend_action

    snr = recommend_action("snr_drop")
    assert snr is not None
    assert snr["action_id"] == "set_payload_mode"
    assert snr["params"] == {"mode": "regenerative"}
    assert snr["inverse_action_id"] == "set_payload_mode"
    assert snr["rationale"]

    assert recommend_action("handover_failure")["action_id"] == "restart_emulator_pod"
    assert (
        recommend_action("gateway_outage")["action_id"] == "scale_copilot_api_replicas"
    )


def test_recommend_action_none_for_doppler_and_unknown() -> None:
    from copilot_api._actions import recommend_action

    # No cluster action mitigates a Doppler-residual issue — recommend nothing.
    assert recommend_action("doppler_compensation_warning") is None
    assert recommend_action("totally_unknown_anomaly") is None


def test_recommend_action_only_whitelisted_ids() -> None:
    # Chain #1: every recommended action_id must be a real safe action.
    from copilot_api._actions import SAFE_ACTION_IDS, recommend_action

    for at in ("snr_drop", "handover_failure", "gateway_outage"):
        rec = recommend_action(at)
        assert rec is not None
        assert rec["action_id"] in SAFE_ACTION_IDS


# ---------------------------------------------------------------------------
# /runbook wiring
# ---------------------------------------------------------------------------


def test_runbook_emits_grounded_action_plan(client: TestClient) -> None:
    r = client.post(
        "/runbook",
        json={
            "anomaly_type": "snr_drop",
            "metrics_snapshot": _snr_drop_metric_snapshot(),
        },
    )
    assert r.status_code == 200
    ap = r.json()["action_plan"]
    assert ap is not None
    assert ap["action_id"] == "set_payload_mode"
    assert ap["params"] == {"mode": "regenerative"}
    assert ap["inverse_action_id"] == "set_payload_mode"
    assert ap["rationale"]


def test_runbook_no_action_plan_without_evidence(client: TestClient) -> None:
    # Grounding: empty metrics → INSUFFICIENT_EVIDENCE → never recommend an action.
    r = client.post(
        "/runbook",
        json={"anomaly_type": "snr_drop", "metrics_snapshot": []},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] != "ok"
    assert body["action_plan"] is None
