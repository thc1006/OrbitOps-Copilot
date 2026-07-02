"""SPEC-S006-VS21 §B (dry_run MVP) — safe-action registry + /action/dry-run.

RED phase: the `_actions` module and the /action/dry-run endpoint do not exist
yet. These tests pin the contract:
  - AC-S006-VS21.B6: only the 3 whitelisted action_ids are accepted (422 else).
  - AC-S006-VS21.B1: each action yields a structured, dry-run-only plan
    (target resource, strategic-merge patch, human-readable diff, inverse).

Hard invariant for this sprint (owner directive: defer apply/security):
  the endpoint is side-effect-free — no git, no cluster mutation, no apply.
  `dry_run` is always True; nothing here touches the network or filesystem
  state. Tests therefore need no cluster and no auth.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from copilot_api.main import app

    return TestClient(app)


# ---------------------------------------------------------------------------
# Registry-level unit tests (no HTTP)
# ---------------------------------------------------------------------------


def test_registry_has_exactly_the_three_safe_actions() -> None:
    from copilot_api._actions import SAFE_ACTION_IDS

    # Chain #6: all 3 ship together, no more, no less (SPEC §5.1).
    assert set(SAFE_ACTION_IDS) == {
        "scale_copilot_api_replicas",
        "restart_emulator_pod",
        "set_payload_mode",
    }


def test_unknown_action_id_raises_unknown_action_error() -> None:
    from copilot_api._actions import UnknownActionError, get_action

    with pytest.raises(UnknownActionError):
        get_action("delete_everything")


def test_scale_action_builds_strategic_merge_patch() -> None:
    from copilot_api._actions import get_action

    action = get_action("scale_copilot_api_replicas")
    patch = action.build_patch({"replicas": 2})
    assert patch == {"spec": {"replicas": 2}}
    assert action.target_kind == "Deployment"
    assert action.target_name == "copilot-api"
    # Scaling is symmetric — its own inverse.
    assert action.inverse_action_id == "scale_copilot_api_replicas"


def test_scale_action_rejects_out_of_range_replicas() -> None:
    from copilot_api._actions import ActionParamError, get_action

    action = get_action("scale_copilot_api_replicas")
    for bad in (0, 4, -1):
        with pytest.raises(ActionParamError):
            action.build_patch({"replicas": bad})


def test_set_payload_mode_rejects_unknown_mode() -> None:
    from copilot_api._actions import ActionParamError, get_action

    action = get_action("set_payload_mode")
    with pytest.raises(ActionParamError):
        action.build_patch({"mode": "quantum"})
    # Valid modes are the 3GPP Rel-19 payload types.
    assert action.build_patch({"mode": "transparent"})
    assert action.build_patch({"mode": "regenerative"})


def test_restart_emulator_has_no_inverse() -> None:
    from copilot_api._actions import get_action

    action = get_action("restart_emulator_pod")
    # Rolling restart is intrinsically forward-only (SPEC §5.1).
    assert action.inverse_action_id is None
    assert action.target_name == "ntn-metrics-emulator"


# ---------------------------------------------------------------------------
# Endpoint: POST /action/dry-run
# ---------------------------------------------------------------------------


def test_dry_run_unknown_action_returns_422(client: TestClient) -> None:
    # AC-S006-VS21.B6
    resp = client.post("/action/dry-run", json={"action_id": "rm_rf", "params": {}})
    assert resp.status_code == 422
    body = resp.json()
    assert body.get("status") == "unknown_action"
    assert "error" in body


def test_dry_run_scale_returns_patch_and_diff(client: TestClient) -> None:
    resp = client.post(
        "/action/dry-run",
        json={"action_id": "scale_copilot_api_replicas", "params": {"replicas": 3}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["action_id"] == "scale_copilot_api_replicas"
    assert body["target_resource"] == "Deployment/copilot-api"
    assert body["patch"] == {"spec": {"replicas": 3}}
    assert body["inverse_action_id"] == "scale_copilot_api_replicas"
    # dry-run invariant: always True + a note that nothing was mutated.
    assert body["dry_run"] is True
    assert "replicas" in body["diff"]
    assert "3" in body["diff"]


def test_dry_run_bad_params_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/action/dry-run",
        json={"action_id": "scale_copilot_api_replicas", "params": {"replicas": 99}},
    )
    assert resp.status_code == 422
    assert resp.json().get("status") == "invalid_params"


def test_dry_run_set_payload_mode_patches_env(client: TestClient) -> None:
    resp = client.post(
        "/action/dry-run",
        json={"action_id": "set_payload_mode", "params": {"mode": "transparent"}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["target_resource"] == "Deployment/ntn-metrics-emulator"
    # patch must set PAYLOAD_MODE somewhere in the env list
    assert "transparent" in body["diff"]
    assert body["inverse_action_id"] == "set_payload_mode"


def test_dry_run_is_side_effect_free_note(client: TestClient) -> None:
    # The whole point this sprint: dry-run must advertise no mutation.
    resp = client.post(
        "/action/dry-run",
        json={"action_id": "restart_emulator_pod", "params": {}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["dry_run"] is True
    assert "no" in body["note"].lower()  # e.g. "no cluster mutation / no git"
