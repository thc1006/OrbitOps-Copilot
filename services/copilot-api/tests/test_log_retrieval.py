"""VS-10b.1 — LokiLogScraper contract.

Foundation for SPEC-003 §Sprint-2 + AC-S005-5 ("copilot's evidence.logs_used
contains ≥ 1 entry from Loki"). This PR ships the SCRAPER CLASS only;
wiring into /ask retrieval lands in VS-10b.2 so the API surface change
and the LLM-grounding flow change are reviewable independently.

Contract tested here:
  - NullLogScraper returns [] (default when ORBITOPS_LOKI_URL unset)
  - LokiLogScraper parses Loki's `query_range` response shape correctly
  - LokiLogScraper constructs the right LogQL + time-range params
  - LokiLogScraper surfaces HTTP errors as exceptions (caller decides
    whether to fall through to evidence-empty or hard-fail)
  - make_default_log_scraper() returns NullLogScraper when env var absent,
    LokiLogScraper when set
"""

from __future__ import annotations

import httpx
import pytest


def test_null_log_scraper_returns_empty() -> None:
    from copilot_api._log_retrieval import NullLogScraper

    s = NullLogScraper()
    assert s.fetch_recent(since_seconds=300) == []


def test_loki_log_scraper_parses_query_range_response() -> None:
    """Loki's `/loki/api/v1/query_range` returns:

      {"data": {"result": [
        {"stream": {"service": "copilot-api"},
         "values": [["<ts_ns>", "<line>"], ...]}, ...
      ]}}

    Scraper must flatten this into a list of LogCitation, one per value
    pair, with `source` from labels and `timestamp` from the nanosecond ts.
    """
    from copilot_api._log_retrieval import LokiLogScraper

    fake_body = {
        "data": {
            "result": [
                {
                    "stream": {"service": "copilot-api"},
                    "values": [
                        ["1714660800000000000", '{"msg":"ask","status":"ok"}'],
                        ["1714660801000000000", '{"msg":"ask","status":"REFUSED"}'],
                    ],
                },
                {
                    "stream": {"service": "ntn-metrics-emulator"},
                    "values": [
                        ["1714660802000000000", '{"msg":"scenario.tick","t_seconds":5}'],
                    ],
                },
            ]
        }
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=fake_body)

    transport = httpx.MockTransport(handler)
    scraper = LokiLogScraper("http://loki:3100", transport=transport)
    out = scraper.fetch_recent(since_seconds=300)

    assert len(out) == 3
    assert out[0].source == "copilot-api"
    assert "ask" in out[0].line
    # Sorted by timestamp; verify by checking that ts increases
    assert out[0].timestamp <= out[1].timestamp <= out[2].timestamp


def test_loki_log_scraper_constructs_logql_query() -> None:
    """Verify LogQL query + time-range params are sane."""
    from copilot_api._log_retrieval import LokiLogScraper

    captured: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["req"] = request
        return httpx.Response(200, json={"data": {"result": []}})

    transport = httpx.MockTransport(handler)
    scraper = LokiLogScraper("http://loki:3100", transport=transport)
    scraper.fetch_recent(since_seconds=300)

    req = captured["req"]
    assert "/loki/api/v1/query_range" in str(req.url)
    # LogQL query must scope to orbitops services (exclude noise like httpx logs).
    qs = dict(req.url.params)
    assert "orbitops" in qs["query"], (
        f"LogQL must scope to orbitops services; got {qs['query']!r}"
    )
    # Loki expects nanosecond epoch for start/end
    start = int(qs["start"])
    end = int(qs["end"])
    assert end - start == 300 * 1_000_000_000, (
        f"end-start must equal 300s in nanoseconds; got {end - start}"
    )


def test_loki_log_scraper_raises_on_http_error() -> None:
    """5xx from Loki should bubble up so the caller (ask handler) can
    fall through to evidence-empty + a 'logs unavailable' note rather
    than silently returning []."""
    from copilot_api._log_retrieval import LokiLogScraper

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="loki down")

    transport = httpx.MockTransport(handler)
    scraper = LokiLogScraper("http://loki:3100", transport=transport)

    with pytest.raises(httpx.HTTPStatusError):
        scraper.fetch_recent(since_seconds=300)


def test_make_default_log_scraper_returns_null_when_no_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When ORBITOPS_LOKI_URL is unset, default to NullLogScraper so
    /ask degrades to logs_used=[] cleanly without a hard dep on Loki."""
    from copilot_api._log_retrieval import (
        NullLogScraper,
        make_default_log_scraper,
    )

    monkeypatch.delenv("ORBITOPS_LOKI_URL", raising=False)
    s = make_default_log_scraper()
    assert isinstance(s, NullLogScraper)


def test_make_default_log_scraper_returns_loki_when_env_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from copilot_api._log_retrieval import (
        LokiLogScraper,
        make_default_log_scraper,
    )

    monkeypatch.setenv("ORBITOPS_LOKI_URL", "http://loki:3100")
    s = make_default_log_scraper()
    assert isinstance(s, LokiLogScraper)


def test_loki_log_scraper_handles_empty_result() -> None:
    """Loki returns 200 with empty `result` when no logs match — must
    return [] cleanly (not raise)."""
    from copilot_api._log_retrieval import LokiLogScraper

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": {"result": []}})

    transport = httpx.MockTransport(handler)
    scraper = LokiLogScraper("http://loki:3100", transport=transport)
    assert scraper.fetch_recent(since_seconds=300) == []


def test_loki_log_scraper_skips_malformed_entries() -> None:
    """Defense-in-depth (round-2 /review A7): a single bad value-pair
    must NOT drop the whole query result. Real-world failure modes:
    Loki itself (rare) or a proxy/CDN re-encoding the response between
    Loki and the scraper. One corrupt entry shouldn't wipe N-1 good
    entries from evidence — partial > zero."""
    from copilot_api._log_retrieval import LokiLogScraper

    body = {
        "data": {
            "result": [
                {
                    "stream": {"service": "copilot-api"},
                    "values": [
                        ["1714660800000000000", "good line 1"],
                        ["not-a-number", "bad timestamp"],  # malformed
                        ["1714660801000000000", "good line 2"],
                    ],
                },
            ],
        },
    }

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=body)

    transport = httpx.MockTransport(handler)
    scraper = LokiLogScraper("http://loki:3100", transport=transport)
    out = scraper.fetch_recent(since_seconds=300)

    # Bad entry skipped; 2 good kept.
    assert len(out) == 2, (
        f"expected 2 good entries (1 malformed skipped); got {len(out)}: {out}"
    )
    assert all("good line" in c.line for c in out)
