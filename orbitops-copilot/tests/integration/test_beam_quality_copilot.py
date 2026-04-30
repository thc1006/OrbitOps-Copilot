"""End-to-end integration test for UC1 — Beam Quality Copilot.

Wires the three Sprint-1 services in-process:

    scenario-generator (file)  ─▶  ntn-metrics-emulator (in-process FastAPI)
                                        │
                                        ▼
                                    /metrics  (Prometheus exposition)
                                        │
                                        ▼
                                copilot-api  (in-process FastAPI; scrapes
                                              the emulator via an injected
                                              MetricsScraper — no real network)

Flow:
    1. Load `packages/scenarios/beam-degradation.json` (already produced by
       scenario-generator with seed=42).
    2. POST /scenario/load on emulator.
    3. POST /scenario/tick {"seconds":90} → t past the snr_drop event window
       (event at t=60..150, magnitude 6 dB on beam-1).
    4. Inject a TestClient-backed scraper into copilot-api so its /ask path
       reads emulator's /metrics in-process.
    5. POST /ask {"question":"Which beam is degrading and why?"} on copilot.
    6. Assert grounded answer cites beam-1 + orbitops_beam_snr_db < 8 dB
       (matches AC-001 invariants).

This test fails BEFORE the integration glue exists (the copilot-api `_scraper`
hook is absent), satisfying the TDD red-phase requirement.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
SCENARIO_PATH = ROOT / "packages" / "scenarios" / "beam-degradation.json"


# --- fixtures ---------------------------------------------------------------


@pytest.fixture
def emulator_client() -> TestClient:
    """In-process emulator with metrics state reset between tests."""
    from ntn_metrics_emulator.main import _reset_state_for_tests, app

    _reset_state_for_tests()
    return TestClient(app)


@pytest.fixture
def copilot_client() -> TestClient:
    from copilot_api.main import app

    return TestClient(app)


class _TestClientScraper:
    """Test-only adapter that satisfies copilot-api's MetricsScraper Protocol
    by calling /metrics on an in-process emulator TestClient. No real socket."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def scrape(self) -> str:
        r = self.client.get("/metrics")
        r.raise_for_status()
        return r.text


@pytest.fixture
def copilot_scraping(emulator_client: TestClient):
    """Wires copilot's module-level scraper to the in-process emulator and
    restores the default after the test (avoids leaking into other tests)."""
    from copilot_api.main import _NULL_SCRAPER, _set_scraper

    _set_scraper(_TestClientScraper(emulator_client))
    yield
    _set_scraper(_NULL_SCRAPER)


# --- happy path: AC-001 ----------------------------------------------------


def test_beam_quality_copilot_end_to_end(
    emulator_client: TestClient,
    copilot_client: TestClient,
    copilot_scraping,
) -> None:
    """UC1 main flow: scenario → emulator tick → /ask → grounded answer."""

    # 1. Load the canonical beam-degradation scenario produced by the
    #    scenario-generator (seed=42) into the emulator.
    scenario = json.loads(SCENARIO_PATH.read_text())
    assert scenario["scenario_id"] == "beam-degradation-001"

    r = emulator_client.post("/scenario/load", json=scenario)
    assert r.status_code == 200
    assert r.json()["loaded"] == "beam-degradation-001"

    # 2. Advance simulated time to t=90 (mid-event).
    r = emulator_client.post("/scenario/tick", json={"seconds": 90})
    assert r.status_code == 200
    assert r.json()["t"] == 90

    # 3. Sanity: emulator now exposes orbitops_beam_snr_db with beam-1 < 8 dB.
    metrics_body = emulator_client.get("/metrics").text
    assert "orbitops_beam_snr_db" in metrics_body
    assert 'beam_id="beam-1"' in metrics_body

    # 4. Ask the copilot in natural language. Copilot must scrape emulator
    #    via the injected scraper, classify into snr_drop, build evidence,
    #    and return a grounded analysis.
    r = copilot_client.post(
        "/ask",
        json={
            "question": "Which beam is degrading and why?",
            "scenario_id": "beam-degradation-001",
            "time_window_seconds": 60,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()

    # AC-001 invariants ---------------------------------------------------

    assert body["status"] == "ok", (
        f"expected status=ok, got {body['status']!r}; full body={body}"
    )

    summary = (body["summary"] or "").lower()
    likely_cause = (body["likely_cause"] or "").lower()
    full_text = summary + " " + likely_cause

    # Answer cites the degrading beam by id
    assert "beam-1" in full_text, f"summary should reference beam-1; got: {full_text!r}"
    # Answer cites SNR
    assert "snr" in full_text, f"summary should reference SNR; got: {full_text!r}"
    # Answer uses degradation-related vocabulary
    assert any(tok in full_text for tok in ("degrad", "drop", "fell", "below")), (
        f"summary should describe degradation; got: {full_text!r}"
    )

    # Evidence cites orbitops_beam_snr_db with at least one value < 8 dB
    snr_evidence = [
        m for m in body["evidence"]["metrics_used"] if m["name"] == "orbitops_beam_snr_db"
    ]
    assert len(snr_evidence) >= 1, "expected ≥1 orbitops_beam_snr_db citation"
    assert any(m["value"] < 8.0 for m in snr_evidence), (
        f"expected ≥1 SNR citation < 8 dB; got values={[m['value'] for m in snr_evidence]}"
    )
    assert any(m["labels"].get("beam_id") == "beam-1" for m in snr_evidence)

    # The /ask response carries the user-supplied scenario_id + time_window.
    assert body["evidence"]["scenario_id"] == "beam-degradation-001"
    assert body["evidence"]["time_window_seconds"] == 60

    # Recommended actions present (UC1 demo expects ≥1 actionable step).
    assert isinstance(body["recommended_actions"], list)
    assert len(body["recommended_actions"]) >= 1
    for action in body["recommended_actions"]:
        assert action["title"]
        assert action["body"]

    # Confidence in expected band — FakeLLMProvider's snr_drop returns 0.78.
    assert 0.5 <= body["confidence"] <= 1.0, body["confidence"]

    # `unknowns` always non-empty for honest grounded answers (AC-003).
    assert isinstance(body["unknowns"], list)
    assert len(body["unknowns"]) >= 1


# --- before-anomaly path: INSUFFICIENT_EVIDENCE ----------------------------


def test_no_anomaly_yet_returns_insufficient(
    emulator_client: TestClient,
    copilot_client: TestClient,
    copilot_scraping,
) -> None:
    """If we don't tick past t=60 the snr_drop event is not yet active; emulator
    still emits orbitops_beam_snr_db but values are above the 8 dB threshold.
    Copilot must say INSUFFICIENT_EVIDENCE rather than hallucinate."""
    scenario = json.loads(SCENARIO_PATH.read_text())
    emulator_client.post("/scenario/load", json=scenario)
    # Note: NO tick — t stays at 0; pre-event window.

    r = copilot_client.post(
        "/ask",
        json={"question": "Which beam is degrading and why?"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "INSUFFICIENT_EVIDENCE", body
    assert body["summary"] is None


# --- refusal path: out-of-domain ------------------------------------------


def test_unsupported_question_is_refused_even_with_anomaly_active(
    emulator_client: TestClient,
    copilot_client: TestClient,
    copilot_scraping,
) -> None:
    """Out-of-domain question must short-circuit BEFORE scraping the emulator.
    Even if the emulator is in a clear anomaly state, /ask refuses."""
    scenario = json.loads(SCENARIO_PATH.read_text())
    emulator_client.post("/scenario/load", json=scenario)
    emulator_client.post("/scenario/tick", json={"seconds": 90})

    r = copilot_client.post(
        "/ask",
        json={"question": "What is the weather in Tokyo today?"},
    )
    body = r.json()
    assert body["status"] == "REFUSED"
    assert body["refusal_reason"] is not None


# --- scraper-not-configured path ------------------------------------------


def test_no_scraper_configured_returns_insufficient(copilot_client: TestClient) -> None:
    """If no scraper is wired (default NullScraper), /ask must return
    INSUFFICIENT_EVIDENCE with a message pointing the user to /explain."""
    # No `copilot_scraping` fixture → NullScraper is in effect.
    r = copilot_client.post(
        "/ask",
        json={"question": "Which beam is degrading?"},
    )
    body = r.json()
    assert body["status"] == "INSUFFICIENT_EVIDENCE"
    # Reason should hint at the configuration / alternative.
    assert any(
        "scrape" in u.lower() or "explain" in u.lower() or "configure" in u.lower()
        for u in body["unknowns"]
    ), body["unknowns"]


# --- PR-H-1: scraper hardening ------------------------------------------


def test_emulator_unreachable_returns_insufficient(copilot_client: TestClient) -> None:
    """HttpMetricsScraper pointed at a closed port must surface as
    INSUFFICIENT_EVIDENCE (not crash, not 500) and the unknowns must mention
    a connection-level cause so operators can debug."""
    from copilot_api._retrieval import HttpMetricsScraper
    from copilot_api.main import _NULL_SCRAPER, _set_scraper

    _set_scraper(HttpMetricsScraper("http://127.0.0.1:1/metrics", timeout_seconds=0.2))
    try:
        r = copilot_client.post("/ask", json={"question": "Which beam is degrading?"})
        body = r.json()
        assert r.status_code == 200
        assert body["status"] == "INSUFFICIENT_EVIDENCE"
        unknowns_text = " ".join(body["unknowns"]).lower()
        assert any(
            tok in unknowns_text
            for tok in ("connect", "scrape", "metrics", "timeout")
        ), body["unknowns"]
    finally:
        _set_scraper(_NULL_SCRAPER)


def test_wrong_url_html_response_returns_insufficient_with_content_type_hint(
    copilot_client: TestClient,
) -> None:
    """If the URL points at a 200-OK HTML page (e.g., the emulator service
    root '/' instead of '/metrics'), the Content-Type guard must trip and
    /ask's unknowns must hint at content-type or path misconfiguration —
    NOT the misleading 'no degraded metrics' message."""
    from copilot_api.main import _NULL_SCRAPER, _set_scraper

    class _HtmlScraperStub:
        """Stub that simulates HttpMetricsScraper hitting a wrong URL whose
        response is HTML; the Content-Type guard raises ValueError."""

        def scrape(self) -> str:
            raise ValueError(
                "Expected Prometheus exposition (Content-Type: text/plain*) "
                "from 'http://127.0.0.1:9999/'; got Content-Type: 'text/html'. "
                "Verify ORBITOPS_EMULATOR_METRICS_URL points at /metrics."
            )

    _set_scraper(_HtmlScraperStub())
    try:
        r = copilot_client.post("/ask", json={"question": "Which beam is degrading?"})
        body = r.json()
        assert body["status"] == "INSUFFICIENT_EVIDENCE"
        unknowns_text = " ".join(body["unknowns"]).lower()
        assert (
            "content-type" in unknowns_text
            or "text/html" in unknowns_text
            or "/metrics" in unknowns_text
        ), body["unknowns"]
    finally:
        _set_scraper(_NULL_SCRAPER)


def test_http_scraper_rejects_html_content_type_unit() -> None:
    """Unit-level guard: HttpMetricsScraper.scrape() raises ValueError when
    Content-Type is not text/plain*. Stubs httpx via sys.modules patching
    so we don't need a real listener."""
    import sys
    import types

    from copilot_api._retrieval import HttpMetricsScraper

    fake_httpx = types.SimpleNamespace()

    class _FakeResponse:
        def __init__(self) -> None:
            self.headers = {"content-type": "text/html; charset=utf-8"}
            self.text = "<html>oops</html>"

        def raise_for_status(self) -> None:
            return None

    class _FakeClient:
        def __init__(self, *_a, **_k) -> None: ...
        def __enter__(self) -> "_FakeClient":
            return self
        def __exit__(self, *_a) -> None:
            return None
        def get(self, _url: str) -> _FakeResponse:
            return _FakeResponse()

    fake_httpx.Client = _FakeClient
    saved = sys.modules.get("httpx")
    sys.modules["httpx"] = fake_httpx  # type: ignore[assignment]
    try:
        with pytest.raises(ValueError, match="text/plain"):
            HttpMetricsScraper("http://example.invalid/").scrape()
    finally:
        if saved is not None:
            sys.modules["httpx"] = saved
        else:
            del sys.modules["httpx"]


def test_http_scraper_accepts_uppercase_content_type_unit() -> None:
    """RFC 7231 §3.1.1.1: media-type is case-insensitive. A server returning
    'Text/Plain; charset=utf-8' (capitalized) must be accepted, not rejected.
    This lock-step test guards against a regression where the guard does a
    naive case-sensitive startswith()."""
    import sys
    import types

    from copilot_api._retrieval import HttpMetricsScraper

    fake_httpx = types.SimpleNamespace()
    EXPOSITION = "# HELP orbitops_beam_snr_db SNR\n# TYPE orbitops_beam_snr_db gauge\norbitops_beam_snr_db{beam_id=\"beam-1\"} 6.5\n"

    class _FakeResponse:
        def __init__(self) -> None:
            # Capitalized + leading whitespace; both must be normalized.
            self.headers = {"content-type": " Text/Plain; version=0.0.4; charset=utf-8"}
            self.text = EXPOSITION

        def raise_for_status(self) -> None:
            return None

    class _FakeClient:
        def __init__(self, *_a, **_k) -> None: ...
        def __enter__(self) -> "_FakeClient":
            return self
        def __exit__(self, *_a) -> None:
            return None
        def get(self, _url: str) -> _FakeResponse:
            return _FakeResponse()

    fake_httpx.Client = _FakeClient
    saved = sys.modules.get("httpx")
    sys.modules["httpx"] = fake_httpx  # type: ignore[assignment]
    try:
        body = HttpMetricsScraper("http://example.invalid/").scrape()
        assert body == EXPOSITION
    finally:
        if saved is not None:
            sys.modules["httpx"] = saved
        else:
            del sys.modules["httpx"]
