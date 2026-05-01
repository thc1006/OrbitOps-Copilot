"""TDD red phase for G6 — copilot-api /metrics endpoint.

Sprint-1 left copilot-api without a Prometheus exposition endpoint, which
made the prometheus-configmap.yaml job permanently DOWN. This test fails
until copilot-api wires a Prometheus instrumentator (e.g.
`prometheus-fastapi-instrumentator`) at app boot. After the green commit
lands, a default request-counter metric must appear in the exposition.

Per CLAUDE.md §12.2: this red commit must precede the green commit in
git history. Do not collapse the two.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from copilot_api.main import app


def test_metrics_endpoint_serves_prometheus_exposition() -> None:
    """GET /metrics returns 200 with text/plain; version=… body."""
    client = TestClient(app)
    r = client.get("/metrics")
    assert r.status_code == 200, r.text
    ctype = r.headers.get("content-type", "")
    assert ctype.startswith("text/plain"), f"unexpected Content-Type: {ctype!r}"


def test_metrics_endpoint_emits_at_least_one_http_counter() -> None:
    """The instrumentator's default request counter must appear in the body
    once at least one request has been served. Drives the body to render at
    least one sample line."""
    client = TestClient(app)
    # Hit /healthz first so a request is recorded.
    client.get("/healthz")
    r = client.get("/metrics")
    body = r.text
    # prometheus-fastapi-instrumentator ships
    # `http_requests_total` (or its `_count` shadow) by default.
    assert (
        "http_requests_total" in body
        or "http_request_duration_seconds_count" in body
    ), (
        "Expected a default HTTP-level Prometheus metric in /metrics "
        "after wiring an instrumentator. Body sample:\n"
        + body[:600]
    )


def test_metrics_endpoint_is_idempotent_across_calls() -> None:
    """Two back-to-back GETs must both return 200; instrumentators that
    leak collector registration would 500 on the second call."""
    client = TestClient(app)
    r1 = client.get("/metrics")
    r2 = client.get("/metrics")
    assert r1.status_code == 200
    assert r2.status_code == 200
