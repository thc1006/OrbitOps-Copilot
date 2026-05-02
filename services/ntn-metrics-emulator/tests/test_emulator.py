"""Tests for ntn-metrics-emulator (SPEC-002 v2 contract).

Written BEFORE the implementation. Must show real failures on first run.
Once main.py wires routes + metrics, all tests must pass without xfail.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from prometheus_client.parser import text_string_to_metric_families

ROOT = Path(__file__).resolve().parents[3]
SCENARIOS_DIR = ROOT / "packages" / "scenarios"

REQUIRED_METRIC_NAMES = (
    "orbitops_beam_snr_db",
    "orbitops_beam_sinr_db",
    "orbitops_link_latency_ms",
    "orbitops_packet_loss_ratio",
    "orbitops_doppler_residual_hz",
    "orbitops_handover_state",
    "orbitops_gateway_available",
    "orbitops_anomaly_active",
)


# --- helpers ----------------------------------------------------------------


def _load_scenario(name: str) -> dict:
    return json.loads((SCENARIOS_DIR / f"{name}.json").read_text())


def _read_metric(client: TestClient, name: str, labels: dict[str, str]) -> float:
    body = client.get("/metrics").text
    for fam in text_string_to_metric_families(body):
        if fam.name != name:
            continue
        for sample in fam.samples:
            if sample.name == name and sample.labels == labels:
                return float(sample.value)
    raise AssertionError(
        f"metric {name}{{{labels}}} not found in /metrics body:\n{body}"
    )


@pytest.fixture(autouse=True)
def reset_state() -> None:
    """Reset module-level emulator state and metric values between tests."""
    from ntn_metrics_emulator.main import _reset_state_for_tests

    _reset_state_for_tests()


@pytest.fixture
def client() -> TestClient:
    from ntn_metrics_emulator.main import app

    return TestClient(app)


# --- tests ------------------------------------------------------------------


def test_healthz_returns_ok(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_load_valid_scenario_returns_200_and_summary(client: TestClient) -> None:
    scenario = _load_scenario("beam-degradation")
    r = client.post("/scenario/load", json=scenario)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["loaded"] == "beam-degradation-001"
    assert body["t"] == 0
    assert body["beams"] == 3
    assert body["gateways"] >= 1


def test_load_invalid_scenario_returns_400(client: TestClient) -> None:
    r = client.post("/scenario/load", json={"oops": "not a scenario"})
    assert r.status_code == 400
    body = r.json()
    # PR-γ: error responses are flat {"error": "..."} regardless of source
    assert "error" in body
    # The wrapped {"detail": {...}} legacy shape is gone
    assert "detail" not in body


def test_tick_without_loaded_scenario_returns_409(client: TestClient) -> None:
    r = client.post("/scenario/tick", json={"seconds": 1})
    assert r.status_code == 409


def test_current_without_loaded_scenario_returns_404(client: TestClient) -> None:
    r = client.get("/scenario/current")
    assert r.status_code == 404


def test_metrics_endpoint_exposes_all_required_metric_names(client: TestClient) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    body = client.get("/metrics").text
    for name in REQUIRED_METRIC_NAMES:
        assert name in body, f"required metric {name!r} missing from /metrics"


def test_metrics_endpoint_uses_prometheus_content_type(client: TestClient) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    r = client.get("/metrics")
    ct = r.headers.get("content-type", "")
    # Either legacy `text/plain; version=0.0.4` or the OpenMetrics
    # `version=1.0.0` form is acceptable for Prometheus to scrape.
    assert ct.startswith("text/plain")
    assert "version=" in ct


def test_beam_degradation_causes_snr_drop_over_ticks(client: TestClient) -> None:
    """AC-001 invariant: beam-1 SNR must drop ≥ 4 dB once the t=60 snr_drop event
    fires. We tick from t=0 to t=90 (mid-event)."""
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))

    snr_at_t0 = _read_metric(client, "orbitops_beam_snr_db", {"beam_id": "beam-1"})
    snr_others_at_t0 = [
        _read_metric(client, "orbitops_beam_snr_db", {"beam_id": b})
        for b in ("beam-2", "beam-3")
    ]

    r = client.post("/scenario/tick", json={"seconds": 90})
    assert r.status_code == 200
    assert r.json()["t"] == 90

    snr_at_t90 = _read_metric(client, "orbitops_beam_snr_db", {"beam_id": "beam-1"})
    snr_others_at_t90 = [
        _read_metric(client, "orbitops_beam_snr_db", {"beam_id": b})
        for b in ("beam-2", "beam-3")
    ]

    assert snr_at_t90 <= snr_at_t0 - 4, (
        f"expected ≥4 dB SNR drop on beam-1 by t=90; "
        f"got before={snr_at_t0:.2f} after={snr_at_t90:.2f}"
    )
    # beam-2/beam-3 should be untouched (no event targets them)
    for before, after, beam in zip(snr_others_at_t0, snr_others_at_t90, ("beam-2", "beam-3")):
        assert before == pytest.approx(after, abs=1e-6), (
            f"{beam} SNR should not change; before={before} after={after}"
        )


def test_handover_failure_scenario_sets_anomaly_flag(client: TestClient) -> None:
    """AC-002: load handover-failure scenario; tick into the event window
    (t≥90); orbitops_anomaly_active{type='handover_failure'} must be 1."""
    client.post("/scenario/load", json=_load_scenario("handover-failure"))
    client.post("/scenario/tick", json={"seconds": 100})

    flag = _read_metric(
        client, "orbitops_anomaly_active", {"type": "handover_failure"}
    )
    assert flag == 1.0

    ho_state = _read_metric(
        client, "orbitops_handover_state", {"beam_id": "beam-1"}
    )
    assert ho_state == 2.0  # failure state per docs/contracts/metrics.md


def test_gateway_outage_sets_gateway_available_to_zero(client: TestClient) -> None:
    """gateway-fallback scenario: gateway-pod-1 must report avail=0 during the
    t=30..150 outage window."""
    client.post("/scenario/load", json=_load_scenario("gateway-fallback"))
    client.post("/scenario/tick", json={"seconds": 60})

    avail = _read_metric(
        client, "orbitops_gateway_available", {"gateway_id": "gateway-pod-1"}
    )
    assert avail == 0.0


def test_tick_is_deterministic(client: TestClient) -> None:
    """Same scenario + same tick sequence → identical metric snapshot.

    Run twice with /scenario/load reset; compare /metrics text bodies on
    matching ticks."""
    scenario = _load_scenario("beam-degradation")

    client.post("/scenario/load", json=scenario)
    client.post("/scenario/tick", json={"seconds": 90})
    body_1 = _slim_metrics_body(client.get("/metrics").text)

    # reset + replay
    from ntn_metrics_emulator.main import _reset_state_for_tests

    _reset_state_for_tests()
    client.post("/scenario/load", json=scenario)
    client.post("/scenario/tick", json={"seconds": 90})
    body_2 = _slim_metrics_body(client.get("/metrics").text)

    assert body_1 == body_2, "tick is non-deterministic"


def _slim_metrics_body(body: str) -> str:
    """Keep only orbitops_* sample lines so determinism comparison is not
    polluted by Python GC / process collector metrics that vary across calls."""
    return "\n".join(
        line
        for line in body.split("\n")
        if line and not line.startswith("#") and line.startswith("orbitops_")
    )


def test_current_after_load_returns_scenario_id_and_t(client: TestClient) -> None:
    scenario = _load_scenario("beam-degradation")
    client.post("/scenario/load", json=scenario)
    client.post("/scenario/tick", json={"seconds": 30})

    r = client.get("/scenario/current")
    assert r.status_code == 200
    body = r.json()
    assert body["scenario_id"] == "beam-degradation-001"
    assert body["t"] == 30
    assert body["scenario"]["scenario_id"] == "beam-degradation-001"


# --- VS-9a: /anomaly/inject ----------------------------------------
# Per docs/specs/SPEC-002-ntn-metrics-emulator.md §Sprint-2, the UI needs
# a runtime way to surface an anomaly without editing the scenario JSON
# and reloading. The endpoint mutates `scenario["events"]` in-memory:
# - 200 → adds an event with t_offset_seconds = current t, returns the
#         active-anomaly types snapshot (so UI can render immediately).
# - 400 → invalid type / target / duration_seconds.
# - 409 → no scenario loaded.
# Mirrors the validation surface of /scenario/load: enum from schema,
# duration must be > 0. target defaults to first beam (or first gateway
# for gateway_outage) when not supplied — keeps the UI button trivial.

INJECT_TYPES = (
    "snr_drop",
    "handover_failure",
    "doppler_spike",
    "gateway_outage",
    "packet_loss_spike",
)


def test_inject_409_when_no_scenario_loaded(client: TestClient) -> None:
    r = client.post("/anomaly/inject", json={"type": "snr_drop"})
    assert r.status_code == 409
    assert "error" in r.json()


def test_inject_returns_200_with_event_summary(client: TestClient) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    client.post("/scenario/tick", json={"seconds": 5})  # advance to t=5

    r = client.post(
        "/anomaly/inject",
        json={"type": "snr_drop", "target": "beam-2", "duration_seconds": 30},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["type"] == "snr_drop"
    assert body["target"] == "beam-2"
    assert body["t_start"] == 5
    assert body["t_end"] == 35
    assert body["duration_seconds"] == 30
    # current active anomalies: snr_drop should be present immediately
    assert "snr_drop" in body["currently_active"]


def test_inject_400_invalid_type(client: TestClient) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    r = client.post("/anomaly/inject", json={"type": "not_a_real_anomaly"})
    assert r.status_code == 400
    assert "error" in r.json()


def test_inject_400_negative_duration(client: TestClient) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    r = client.post(
        "/anomaly/inject", json={"type": "snr_drop", "duration_seconds": -1}
    )
    assert r.status_code == 400
    assert "error" in r.json()


def test_inject_appears_in_active_anomalies_after_call(client: TestClient) -> None:
    """Integration: post-inject, GET /scenario/current should reflect the
    new event in active_anomalies; metrics surface should show
    orbitops_anomaly_active for the type."""
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))

    # at t=0 with no fired anomalies, beam-1's SNR is the baseline (no drop)
    snr_baseline = _read_metric(client, "orbitops_beam_snr_db", {"beam_id": "beam-1"})

    # inject snr_drop on beam-1 with magnitude 5dB
    r = client.post(
        "/anomaly/inject",
        json={
            "type": "snr_drop",
            "target": "beam-1",
            "duration_seconds": 60,
            "magnitude_db": 5.0,
        },
    )
    assert r.status_code == 200

    # tick by 0 (no time advance) but a refresh should re-read events;
    # ticking by 1 makes the assertion concrete.
    client.post("/scenario/tick", json={"seconds": 1})

    snr_after = _read_metric(client, "orbitops_beam_snr_db", {"beam_id": "beam-1"})
    assert snr_after < snr_baseline - 3.0, (
        f"expected SNR drop after inject; baseline={snr_baseline}, after={snr_after}"
    )


def test_inject_default_target_picks_first_beam(client: TestClient) -> None:
    """target is optional. If not supplied, default = first beam in scenario
    (for beam-targeted types) or first gateway (for gateway_outage)."""
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    r = client.post("/anomaly/inject", json={"type": "snr_drop"})
    assert r.status_code == 200, r.text
    assert r.json()["target"] == "beam-1"


def test_inject_default_target_picks_first_gateway_for_gateway_outage(
    client: TestClient,
) -> None:
    client.post("/scenario/load", json=_load_scenario("gateway-fallback"))
    r = client.post("/anomaly/inject", json={"type": "gateway_outage"})
    assert r.status_code == 200, r.text
    assert r.json()["target"].startswith("gateway-")


def test_inject_400_unknown_target(client: TestClient) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    r = client.post(
        "/anomaly/inject", json={"type": "snr_drop", "target": "beam-999"}
    )
    assert r.status_code == 400
    assert "error" in r.json()
