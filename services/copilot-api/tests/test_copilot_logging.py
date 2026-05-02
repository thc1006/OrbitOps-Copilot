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
    assert len(matching) == 1, (
        f"expected exactly 1 ask log line; got {len(matching)}"
    )
    rec = matching[0]
    # status from response body must equal status on log record
    body = r.json()
    assert getattr(rec, "status", None) == body["status"]
    # PII-safe: log captures char count, NOT the question text
    assert getattr(rec, "question_chars", None) == len(
        "Is beam-1 healthy right now?"
    )
    # Question text itself MUST NOT be logged (prompt-injection / privacy)
    rendered = json.dumps(rec.__dict__, default=str)
    assert "beam-1 healthy right now" not in rendered, (
        "question text leaked into log record dict — privacy contract violated"
    )
