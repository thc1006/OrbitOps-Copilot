"""VS-10b.2 — /ask wires LokiLogScraper into evidence.logs_used.

Closes AC-S005-5 ("copilot's evidence.logs_used contains ≥ 1 entry from
Loki") for the OK-grounded path. /ask now:

  1. Scrapes metrics (existing path).
  2. Classifies anomaly_type from metrics (existing path).
  3. NEW: queries the configured LogScraper for recent log lines and
     attaches them to Evidence.logs_used BEFORE invoking the LLM.
  4. Calls the provider with metrics + logs in evidence.
  5. Returns CopilotResponse.

Failure mode (Loki unreachable / 5xx) DEGRADES GRACEFULLY: /ask still
returns ok with metrics-only evidence; an "logs unavailable" entry is
appended to `unknowns` so the operator can debug. Mirrors the existing
metrics-scraper-failure pattern.

Test surfaces:
  - happy path: log scraper returns 2 LogCitations → evidence.logs_used
    has 2 entries; /ask returns status=ok
  - fail path: log scraper raises → /ask still ok with logs_used=[];
    unknowns mentions logs unavailable
  - default path: NullLogScraper (factory default) → logs_used=[]
  - time_window: log scraper called with since_seconds matching the
    request's time_window_seconds (or 300 default)
  - REFUSED path: log scraper NOT called (no point fetching logs for
    out-of-domain question)
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from copilot_api.models import LogCitation


# --- mocks -----------------------------------------------------------


class _SnrDropScraper:
    """Metric scraper that triggers `snr_drop` classification."""

    def scrape(self) -> str:
        return (
            "# HELP orbitops_beam_snr_db SNR\n"
            "# TYPE orbitops_beam_snr_db gauge\n"
            'orbitops_beam_snr_db{beam_id="beam-1"} 6.5\n'
        )


class _RecordingLogScraper:
    """LogScraper test double that captures fetch_recent kwargs and
    returns a configurable list (or raises)."""

    def __init__(
        self,
        citations: list[LogCitation] | None = None,
        exc: Exception | None = None,
    ) -> None:
        self.citations = citations or []
        self.exc = exc
        self.calls: list[int] = []

    def fetch_recent(self, *, since_seconds: int) -> list[LogCitation]:
        self.calls.append(since_seconds)
        if self.exc is not None:
            raise self.exc
        return self.citations


def _two_log_citations() -> list[LogCitation]:
    return [
        LogCitation(
            source="ntn-metrics-emulator",
            line='{"msg":"anomaly.inject","event_type":"snr_drop"}',
            timestamp=datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc),
        ),
        LogCitation(
            source="copilot-api",
            line='{"msg":"ask","status":"ok"}',
            timestamp=datetime(2026, 5, 2, 12, 0, 5, tzinfo=timezone.utc),
        ),
    ]


# --- fixtures --------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_state() -> None:
    """Each test starts with NullScraper + NullLogScraper so prior
    tests don't leak module-global state."""
    from copilot_api.main import (
        _NULL_LOG_SCRAPER,
        _NULL_SCRAPER,
        _set_log_scraper,
        _set_scraper,
    )

    _set_scraper(_NULL_SCRAPER)
    _set_log_scraper(_NULL_LOG_SCRAPER)


@pytest.fixture
def client() -> TestClient:
    from copilot_api.main import app

    return TestClient(app)


# --- happy path ------------------------------------------------------


def test_ask_includes_logs_in_evidence_when_log_scraper_returns_results(
    client: TestClient,
) -> None:
    from copilot_api.main import _set_log_scraper, _set_scraper

    _set_scraper(_SnrDropScraper())
    log_scraper = _RecordingLogScraper(citations=_two_log_citations())
    _set_log_scraper(log_scraper)

    r = client.post("/ask", json={"question": "Which beam is degrading and why?"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok", body
    logs_used = body["evidence"]["logs_used"]
    assert len(logs_used) == 2, f"expected 2 log entries; got {logs_used}"
    sources = {entry["source"] for entry in logs_used}
    assert sources == {"ntn-metrics-emulator", "copilot-api"}


def test_ask_default_log_scraper_yields_empty_logs_used(
    client: TestClient,
) -> None:
    """With the default NullLogScraper (no ORBITOPS_LOKI_URL), /ask must
    still classify successfully but evidence.logs_used == []."""
    from copilot_api.main import _set_scraper

    _set_scraper(_SnrDropScraper())

    r = client.post("/ask", json={"question": "Which beam is degrading and why?"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["evidence"]["logs_used"] == []


# --- failure mode ----------------------------------------------------


def test_ask_degrades_gracefully_when_log_scraper_raises(
    client: TestClient,
) -> None:
    """Loki unreachable / 5xx must NOT break /ask — surface the failure
    in unknowns and continue with metrics-only evidence."""
    from copilot_api.main import _set_log_scraper, _set_scraper

    _set_scraper(_SnrDropScraper())
    _set_log_scraper(_RecordingLogScraper(exc=RuntimeError("loki unreachable")))

    r = client.post("/ask", json={"question": "Which beam is degrading and why?"})
    assert r.status_code == 200
    body = r.json()
    # /ask still works with metrics-only evidence
    assert body["status"] == "ok", body
    assert body["evidence"]["logs_used"] == []
    # unknowns mentions logs so operator can debug
    unknowns = " ".join(body["unknowns"]).lower()
    assert "log" in unknowns, (
        f"expected 'logs unavailable' note in unknowns; got {body['unknowns']}"
    )


# --- time-window propagation -----------------------------------------


def test_ask_calls_log_scraper_with_request_time_window(
    client: TestClient,
) -> None:
    """If `time_window_seconds` is on the request, log scraper sees it."""
    from copilot_api.main import _set_log_scraper, _set_scraper

    _set_scraper(_SnrDropScraper())
    log_scraper = _RecordingLogScraper(citations=_two_log_citations())
    _set_log_scraper(log_scraper)

    client.post(
        "/ask",
        json={
            "question": "Which beam is degrading and why?",
            "time_window_seconds": 60,
        },
    )

    assert log_scraper.calls == [60], (
        f"expected since_seconds=60 from request; got {log_scraper.calls}"
    )


def test_ask_log_scraper_default_window_is_300s(
    client: TestClient,
) -> None:
    """Without time_window_seconds, default 300s (matches LokiLogScraper)."""
    from copilot_api.main import _set_log_scraper, _set_scraper

    _set_scraper(_SnrDropScraper())
    log_scraper = _RecordingLogScraper(citations=_two_log_citations())
    _set_log_scraper(log_scraper)

    client.post("/ask", json={"question": "Which beam is degrading and why?"})

    assert log_scraper.calls == [300], (
        f"expected default 300s; got {log_scraper.calls}"
    )


# --- REFUSED path: don't fetch logs ---------------------------------


def test_ask_refused_path_does_not_call_log_scraper(client: TestClient) -> None:
    """Out-of-domain questions skip retrieval entirely — calling Loki
    when we already know we'll refuse is wasted I/O."""
    from copilot_api.main import _set_log_scraper

    log_scraper = _RecordingLogScraper(citations=_two_log_citations())
    _set_log_scraper(log_scraper)

    client.post("/ask", json={"question": "What is the weather in Taipei?"})

    assert log_scraper.calls == [], (
        f"refused path must not query log scraper; got {log_scraper.calls}"
    )
