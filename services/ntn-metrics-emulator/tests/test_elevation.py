"""TDD red phase for G7 — orbitops_beam_elevation_deg gauge.

Original Use Case 1 listed elevation angle in the metric set. Sprint-1
shipped without it; this test fails until _compute.py exposes
`elevation_deg(t, scenario, beam)` and main.py registers/updates the
corresponding Prometheus gauge per beam.

Constraints driven by the emulator's role:
  - elevation must stay in [0, 90] deg (geometry; below-0 is invisible)
  - across a pass it should rise → peak → fall (sin-shaped is enough for Sprint-1)
  - peak elevation is configurable via scenario.satellite (default ~60°)
  - sample shape: orbitops_beam_elevation_deg{beam_id="<id>"}

Per CLAUDE.md §12.2 this red commit must land before the green impl.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
SCENARIO_PATH = ROOT / "packages" / "scenarios" / "beam-degradation.json"


@pytest.fixture
def client_with_scenario_loaded() -> TestClient:
    from ntn_metrics_emulator.main import _reset_state_for_tests, app

    _reset_state_for_tests()
    c = TestClient(app)
    scenario = json.loads(SCENARIO_PATH.read_text())
    r = c.post("/scenario/load", json=scenario)
    assert r.status_code == 200, r.text
    return c


def test_elevation_metric_present_in_metrics(
    client_with_scenario_loaded: TestClient,
) -> None:
    """After /scenario/load, /metrics must include an
    orbitops_beam_elevation_deg gauge sample for every beam."""
    body = client_with_scenario_loaded.get("/metrics").text
    assert "orbitops_beam_elevation_deg" in body, (
        "Expected orbitops_beam_elevation_deg gauge after scenario load. "
        f"First 800 chars of /metrics:\n{body[:800]}"
    )
    # All three beams from beam-degradation.json must each emit an
    # elevation sample.
    for bid in ("beam-1", "beam-2", "beam-3"):
        assert f'orbitops_beam_elevation_deg{{beam_id="{bid}"}}' in body, (
            f"missing elevation sample for {bid}"
        )


def test_elevation_value_within_geometric_bounds(
    client_with_scenario_loaded: TestClient,
) -> None:
    """Elevation is geometric — must be in [0, 90] deg at any tick."""
    c = client_with_scenario_loaded
    for tick_seconds in (0, 60, 180, 300, 540):
        c.post("/scenario/tick", json={"seconds": tick_seconds - _last_tick(c)})
        body = c.get("/metrics").text
        for line in body.splitlines():
            if not line.startswith("orbitops_beam_elevation_deg"):
                continue
            value = float(line.rsplit(" ", 1)[-1])
            assert 0.0 <= value <= 90.0, (
                f"elevation out of bounds at t={tick_seconds}: {line}"
            )


def _last_tick(client: TestClient) -> int:
    """Helper: read /scenario/current to compute the delta needed for
    the next tick request. The emulator's tick endpoint is incremental."""
    r = client.get("/scenario/current")
    return int(r.json().get("t", 0))


def test_elevation_rises_then_falls_over_pass(
    client_with_scenario_loaded: TestClient,
) -> None:
    """A LEO satellite-pass elevation curve rises from 0 → peak → 0. The
    Sprint-1 emulator can use any monotone-then-monotone shape (e.g.
    sin(pi * t / pass_duration)); this test only asserts the qualitative
    shape: middle > start AND middle > end."""
    c = client_with_scenario_loaded

    def sample_at(t: int) -> float:
        cur = _last_tick(c)
        c.post("/scenario/tick", json={"seconds": t - cur})
        body = c.get("/metrics").text
        for line in body.splitlines():
            if line.startswith('orbitops_beam_elevation_deg{beam_id="beam-1"}'):
                return float(line.rsplit(" ", 1)[-1])
        raise AssertionError("beam-1 elevation not found")

    # beam-degradation-001 pass is 600s by scenario.duration_seconds.
    elev_start = sample_at(0)
    elev_mid = sample_at(300)
    elev_end = sample_at(580)

    assert elev_mid > elev_start, f"mid {elev_mid} should exceed start {elev_start}"
    assert elev_mid > elev_end, f"mid {elev_mid} should exceed end {elev_end}"
