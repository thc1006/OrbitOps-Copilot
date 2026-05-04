"""VS-10a — structured JSON logging contract for copilot-api.

Closes I-9 (Low). copilot-api's /ask outcomes (REFUSED / INSUFFICIENT /
ok / ERROR) currently happen silently — the response carries `status`
in the body but nothing reaches stdout for log-aggregation pipelines.
For Sprint-2 Loki integration (VS-10b) and for the SPEC-003 audit trail
("which question got which classification"), those outcomes must
emit one INFO line per /ask with the question + status + evidence
counts.

Field contract (locked-in by these tests):

  msg         — "ask" (one tag per /ask call)
  status      — CopilotResponse.status
  question_chars — len(question)  (PII-safe; question itself is NOT
                   logged because user prompts could include sensitive
                   substrings injected via prompt-injection attempts)
  metrics_used   — count of MetricCitation entries in evidence
  logs_used      — count of LogCitation entries in evidence
  scenario_id    — when set on the response, else absent
"""

from __future__ import annotations

import json
import logging

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from copilot_api.main import app

    return TestClient(app)


# --- formatter unit tests ---------------------------------------------


def test_json_formatter_emits_parseable_json() -> None:
    from copilot_api._logging import JsonFormatter

    fmt = JsonFormatter()
    record = logging.LogRecord(
        name="copilot_api.main",
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg="ask",
        args=None,
        exc_info=None,
    )
    out = fmt.format(record)
    parsed = json.loads(out)
    assert parsed["msg"] == "ask"
    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "copilot_api.main"


def test_json_formatter_preserves_extra_fields() -> None:
    from copilot_api._logging import JsonFormatter

    fmt = JsonFormatter()
    record = logging.LogRecord(
        name="copilot_api.main",
        level=logging.INFO,
        pathname=__file__,
        lineno=0,
        msg="ask",
        args=None,
        exc_info=None,
    )
    record.status = "ok"
    record.question_chars = 47
    record.metrics_used = 3
    parsed = json.loads(fmt.format(record))
    assert parsed["status"] == "ok"
    assert parsed["question_chars"] == 47
    assert parsed["metrics_used"] == 3


# --- /ask emission test (uses INSUFFICIENT_EVIDENCE branch which is
# robust to env / provider config — doesn't need a real LLM) ----------


def test_ask_emits_structured_log_with_status_and_question_chars(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="copilot_api.main"):
        r = client.post(
            "/ask",
            json={"question": "Is beam-1 healthy right now?"},
        )
    assert r.status_code == 200

    matching = [
        rec
        for rec in caplog.records
        if rec.name == "copilot_api.main" and getattr(rec, "msg", None) == "ask"
    ]
    assert len(matching) == 1, f"expected exactly 1 ask log line; got {len(matching)}"
    rec = matching[0]
    # status from response body must equal status on log record
    body = r.json()
    assert getattr(rec, "status", None) == body["status"]
    # PII-safe: log captures char count, NOT the question text
    assert getattr(rec, "question_chars", None) == len("Is beam-1 healthy right now?")
    # Question text itself MUST NOT be logged (prompt-injection / privacy)
    rendered = json.dumps(rec.__dict__, default=str)
    assert "beam-1 healthy right now" not in rendered, (
        "question text leaked into log record dict — privacy contract violated"
    )


# ─── round-2 /review B: /explain + /runbook audit asymmetry ─────────
# SPEC-003 covers all three endpoints. /ask logs but /explain + /runbook
# don't — the audit trail is incomplete. Operator can't trace which
# anomaly_type was queried via /explain or /runbook, which classification
# was returned, or whether the response was ok / INSUFFICIENT.


@pytest.fixture
def explain_request_body() -> dict:
    """Minimal valid /explain or /runbook body. Empty metrics_snapshot
    deliberately drives the INSUFFICIENT_EVIDENCE path so the test
    doesn't need a real LLM provider configured."""
    return {
        "anomaly_type": "snr_drop",
        "metrics_snapshot": [],
        "logs": [],
    }


def test_explain_emits_structured_log(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    explain_request_body: dict,
) -> None:
    with caplog.at_level(logging.INFO, logger="copilot_api.main"):
        r = client.post("/explain", json=explain_request_body)
    assert r.status_code == 200

    matching = [
        rec
        for rec in caplog.records
        if rec.name == "copilot_api.main" and getattr(rec, "msg", None) == "explain"
    ]
    assert len(matching) == 1, f"expected 1 explain log line; got {len(matching)}"
    rec = matching[0]
    body = r.json()
    assert getattr(rec, "status", None) == body["status"]
    # anomaly_type appears on the request and should appear in the log
    # so an operator can correlate "what was asked about" with status.
    assert getattr(rec, "anomaly_type", None) == "snr_drop"


def test_runbook_emits_structured_log(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    explain_request_body: dict,
) -> None:
    with caplog.at_level(logging.INFO, logger="copilot_api.main"):
        r = client.post("/runbook", json=explain_request_body)
    assert r.status_code == 200

    matching = [
        rec
        for rec in caplog.records
        if rec.name == "copilot_api.main" and getattr(rec, "msg", None) == "runbook"
    ]
    assert len(matching) == 1, f"expected 1 runbook log line; got {len(matching)}"
    rec = matching[0]
    body = r.json()
    assert getattr(rec, "status", None) == body["status"]
    assert getattr(rec, "anomaly_type", None) == "snr_drop"


def test_ask_explain_runbook_log_msg_distinguishable(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    explain_request_body: dict,
) -> None:
    """Three endpoints must emit three distinct `msg` tags so the log
    stream can be filtered per-endpoint."""
    with caplog.at_level(logging.INFO, logger="copilot_api.main"):
        client.post("/ask", json={"question": "Is beam-1 healthy?"})
        client.post("/explain", json=explain_request_body)
        client.post("/runbook", json=explain_request_body)

    msgs = {
        getattr(rec, "msg", None)
        for rec in caplog.records
        if rec.name == "copilot_api.main"
    }
    assert {"ask", "explain", "runbook"}.issubset(msgs)


# ─── round-3 / VS-10c: uvicorn-aware logging ────────────────────────
# The 2026-05-04 live-cluster smoke surfaced that `setup_logging()`
# only configures the root logger's handlers. uvicorn registers its
# OWN handlers on `uvicorn` / `uvicorn.error` / `uvicorn.access` BEFORE
# the app module is imported (uvicorn does its own logging.config call
# during server startup), and those handlers don't propagate up to
# root by default — they have their own StreamHandler with a plain-
# text formatter. Result: pod stdout is a mix of:
#
#   {"ts":...,"msg":"ask",...}                                      ← good (root logger via app)
#   INFO:     10.244.0.93:42194 - "GET /healthz HTTP/1.1" 200 OK    ← bad (uvicorn.access plain text)
#
# Loki receives both shapes; grep / parse gets harder. Proper fix:
# `setup_logging()` must also iterate the uvicorn-namespace loggers
# and force their handlers to use JsonFormatter (or remove their
# handlers and let propagation up to the JSON-configured root handle
# emission).


def test_setup_logging_configures_uvicorn_loggers_to_json_format() -> None:
    """After setup_logging(), uvicorn / uvicorn.error / uvicorn.access
    loggers must produce JSON output, not plain-text 'INFO: ...' lines.

    Mechanism options:
      (a) Replace each uvicorn-namespace logger's handlers with one
          using JsonFormatter (explicit).
      (b) Clear each uvicorn-namespace logger's handlers + set
          propagate=True so root's JsonFormatter handler picks them up
          (idiomatic Python logging composition).

    Either works; this test asserts the OBSERVABLE outcome (output
    parses as JSON), not the mechanism. Passes for either fix."""
    import io
    import sys

    from copilot_api._logging import _reset_for_tests, setup_logging

    _reset_for_tests()

    # Simulate uvicorn's "I added my own handler" by giving each
    # uvicorn logger a plain-text StreamHandler before setup_logging.
    plain_buf = io.StringIO()
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        h = logging.StreamHandler(plain_buf)
        h.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        lg.addHandler(h)
        lg.propagate = False  # uvicorn's default

    # Now configure our logging — should override uvicorn's per-logger
    # handlers OR redirect to root with JSON formatter.
    setup_logging()

    # Capture stdout for assertion.
    json_buf = io.StringIO()
    root = logging.getLogger()
    for h in root.handlers:
        if hasattr(h, "stream") and h.stream is sys.stdout:
            h.stream = json_buf

    # Emit a record on each uvicorn logger.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).info("hello from %s", name)

    # PR #62 review (Copilot bot, 2026-05-04) — strengthen the contract:
    # a broken implementation that only flips `propagate=True` without
    # clearing the pre-existing uvicorn handlers would still let the
    # JSON-parseable assertion below pass (root + JsonFormatter still
    # gets a copy via propagation), while the OLD plain-text handler
    # continued to spam pod stdout in parallel. Asserting `plain_buf`
    # is empty after setup_logging() catches that variant.
    assert plain_buf.getvalue() == "", (
        "setup_logging() must silence pre-existing uvicorn handlers; "
        f"plain-text handler still wrote {len(plain_buf.getvalue())} bytes: "
        f"{plain_buf.getvalue()!r}"
    )

    captured = json_buf.getvalue()
    # Each line that came out should be JSON parseable.
    for line in captured.strip().split("\n"):
        if not line:
            continue
        # Plain-text "INFO: hello from uvicorn" would fail this
        try:
            parsed = json.loads(line)
            assert "ts" in parsed and "msg" in parsed, f"line missing ts/msg: {line!r}"
        except json.JSONDecodeError as exc:
            pytest.fail(
                f"uvicorn-namespace log line is not JSON after setup_logging: "
                f"{line!r} (parse error: {exc})"
            )


def test_setup_logging_does_not_double_emit_via_propagation() -> None:
    """If we clear uvicorn handlers + set propagate=True, the message
    must reach root EXACTLY ONCE (not 0, not 2). Belt-and-braces guard
    against fix variants that would double-log.

    PR #62 review (Copilot bot, 2026-05-04) extension — pre-attach a
    plain-text handler simulating uvicorn's default before calling
    setup_logging(), then assert it stays silent. A broken impl that
    only sets `propagate=True` without clearing the old handler would
    fail this `plain_buf == ""` assertion."""
    import io

    from copilot_api._logging import _reset_for_tests, setup_logging

    _reset_for_tests()

    # Pre-attach a plain-text handler on uvicorn.access (matching what
    # uvicorn does at startup). setup_logging() must remove it.
    plain_buf = io.StringIO()
    uv_access = logging.getLogger("uvicorn.access")
    uv_access.handlers.clear()
    plain_handler = logging.StreamHandler(plain_buf)
    plain_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    uv_access.addHandler(plain_handler)
    uv_access.propagate = False  # uvicorn's default

    setup_logging()

    json_buf = io.StringIO()
    root = logging.getLogger()
    for h in root.handlers:
        if hasattr(h, "stream"):
            h.stream = json_buf

    logging.getLogger("uvicorn.access").info("single message")

    # The old plain-text handler must not have fired (broken-impl guard).
    assert plain_buf.getvalue() == "", (
        f"old plain-text handler still emitted: {plain_buf.getvalue()!r}"
    )

    output_lines = [line for line in json_buf.getvalue().strip().split("\n") if line]
    matching = [line for line in output_lines if "single message" in line]
    assert len(matching) == 1, (
        f"expected exactly 1 emission of 'single message'; got "
        f"{len(matching)}: {output_lines}"
    )
