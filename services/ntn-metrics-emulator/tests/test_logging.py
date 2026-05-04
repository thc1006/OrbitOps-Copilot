"""VS-10a — structured JSON logging contract for ntn-metrics-emulator.

Closes I-9 (Low) for the emulator side. The emulator's scenario lifecycle
events (load / tick / inject) currently happen silently from the
operator's perspective — only the HTTP response surfaces them. For
Sprint-2 Loki integration (VS-10b) and for runbook evidence retrieval
on the copilot side, those events MUST land on stdout as parseable
JSON with consistent field naming.

Tests target two surfaces:

  1. The JsonFormatter — pure unit (no FastAPI / TestClient needed).
  2. The /scenario/load + /scenario/tick + /anomaly/inject handlers
     emit one structured INFO line per call with the expected fields.

Field contract (locked-in by these tests):

  ts          — ISO-8601 UTC timestamp (set by formatter)
  level       — INFO | WARNING | ERROR (Python logging level name)
  logger      — qualified module name (record.name)
  msg         — short event tag (e.g. "scenario.load", "anomaly.inject")
  scenario_id — scenario identifier when one is loaded (else absent)
  + per-event fields (see individual tests)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
SCENARIOS_DIR = ROOT / "packages" / "scenarios"


def _load_scenario(name: str) -> dict:
    return json.loads((SCENARIOS_DIR / f"{name}.json").read_text())


@pytest.fixture(autouse=True)
def reset_state() -> None:
    from ntn_metrics_emulator.main import _reset_state_for_tests

    _reset_state_for_tests()


@pytest.fixture
def client() -> TestClient:
    from ntn_metrics_emulator.main import app

    return TestClient(app)


# --- formatter unit tests ---------------------------------------------


def test_json_formatter_emits_parseable_json() -> None:
    from ntn_metrics_emulator._logging import JsonFormatter

    fmt = JsonFormatter()
    record = logging.LogRecord(
        name="ntn_metrics_emulator.main",
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg="scenario.load",
        args=None,
        exc_info=None,
    )
    out = fmt.format(record)
    parsed = json.loads(out)
    assert parsed["msg"] == "scenario.load"
    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "ntn_metrics_emulator.main"
    # ts is set by the formatter from record.created; assert ISO-8601 shape
    assert "T" in parsed["ts"]
    assert parsed["ts"].endswith("+00:00") or parsed["ts"].endswith("Z")


def test_json_formatter_preserves_extra_fields() -> None:
    from ntn_metrics_emulator._logging import JsonFormatter

    fmt = JsonFormatter()
    record = logging.LogRecord(
        name="ntn_metrics_emulator.main",
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg="anomaly.inject",
        args=None,
        exc_info=None,
    )
    record.scenario_id = "beam-degradation-001"
    record.event_type = "snr_drop"
    record.target = "beam-1"
    parsed = json.loads(fmt.format(record))
    assert parsed["scenario_id"] == "beam-degradation-001"
    assert parsed["event_type"] == "snr_drop"
    assert parsed["target"] == "beam-1"


# --- handler emission tests --------------------------------------------


def test_scenario_load_emits_structured_log(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    """Per VS-10a contract, /scenario/load INFO-logs once per call with
    msg='scenario.load' + scenario_id + beams + gateways."""
    scenario = _load_scenario("beam-degradation")
    with caplog.at_level(logging.INFO, logger="ntn_metrics_emulator.main"):
        r = client.post("/scenario/load", json=scenario)
    assert r.status_code == 200

    matching = [
        rec
        for rec in caplog.records
        if rec.name == "ntn_metrics_emulator.main"
        and getattr(rec, "msg", None) == "scenario.load"
    ]
    assert len(matching) == 1, (
        f"expected exactly 1 scenario.load log line; got {len(matching)}"
    )
    rec = matching[0]
    assert getattr(rec, "scenario_id", None) == "beam-degradation-001"
    assert getattr(rec, "beams", None) == 3


def test_scenario_tick_emits_structured_log(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    with caplog.at_level(logging.INFO, logger="ntn_metrics_emulator.main"):
        r = client.post("/scenario/tick", json={"seconds": 30})
    assert r.status_code == 200

    matching = [
        rec for rec in caplog.records if getattr(rec, "msg", None) == "scenario.tick"
    ]
    assert len(matching) >= 1
    rec = matching[0]
    assert getattr(rec, "t_seconds", None) == 30
    assert getattr(rec, "scenario_id", None) == "beam-degradation-001"


def test_anomaly_inject_emits_structured_log(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    client.post("/scenario/load", json=_load_scenario("beam-degradation"))
    with caplog.at_level(logging.INFO, logger="ntn_metrics_emulator.main"):
        r = client.post(
            "/anomaly/inject",
            json={"type": "snr_drop", "target": "beam-2", "duration_seconds": 30},
        )
    assert r.status_code == 200

    matching = [
        rec for rec in caplog.records if getattr(rec, "msg", None) == "anomaly.inject"
    ]
    assert len(matching) == 1
    rec = matching[0]
    assert getattr(rec, "event_type", None) == "snr_drop"
    assert getattr(rec, "target", None) == "beam-2"
    assert getattr(rec, "scenario_id", None) == "beam-degradation-001"


# ─── round-3 / VS-10c: uvicorn-aware logging ──────────────────────────
# Same contract as copilot-api's test_copilot_logging.py — see that
# file's docstring for full rationale. emulator's setup_logging() must
# also tame uvicorn-namespace loggers so pod stdout is JSON-only.


def test_setup_logging_configures_uvicorn_loggers_to_json_format() -> None:
    import io
    import json as jsonlib
    import logging
    import sys

    from ntn_metrics_emulator._logging import _reset_for_tests, setup_logging

    _reset_for_tests()

    plain_buf = io.StringIO()
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        h = logging.StreamHandler(plain_buf)
        h.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        lg.addHandler(h)
        lg.propagate = False

    setup_logging()

    json_buf = io.StringIO()
    root = logging.getLogger()
    for h in root.handlers:
        if hasattr(h, "stream") and h.stream is sys.stdout:
            h.stream = json_buf

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).info("hello from %s", name)

    for line in json_buf.getvalue().strip().split("\n"):
        if not line:
            continue
        try:
            parsed = jsonlib.loads(line)
            assert "ts" in parsed and "msg" in parsed
        except jsonlib.JSONDecodeError as exc:
            import pytest

            pytest.fail(f"non-JSON line: {line!r} ({exc})")


def test_setup_logging_does_not_double_emit_via_propagation() -> None:
    import io
    import logging

    from ntn_metrics_emulator._logging import _reset_for_tests, setup_logging

    _reset_for_tests()
    setup_logging()

    json_buf = io.StringIO()
    root = logging.getLogger()
    for h in root.handlers:
        if hasattr(h, "stream"):
            h.stream = json_buf

    logging.getLogger("uvicorn.access").info("single message")
    matching = [
        line
        for line in json_buf.getvalue().strip().split("\n")
        if "single message" in line
    ]
    assert len(matching) == 1, f"got {len(matching)}: {matching}"
