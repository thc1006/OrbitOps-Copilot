"""SPEC-S003-VS19 red commit — failing tests for OIDC + JWT auth.

These tests pin **AC-S003-VS19.1, .7, and .9** before any implementation
lands. All three currently FAIL because copilot-api has zero auth wiring
on its `/ask`/`/explain`/`/runbook` endpoints (verified by reading
services/copilot-api/src/copilot_api/main.py:243/380/387 — no
`Depends(verify_jwt)` anywhere).

Why three ACs in one red commit (not just AC.1):
  - AC.1 alone passes trivially with `if Authorization is None: 401` —
    a straw-man impl could green it without doing real JWT work.
  - AC.7 prevents the next contributor from "fixing" AC.1 by globally
    requiring auth (which would break /healthz K8s probes + /metrics
    Prometheus scrape; SPEC §6 explicit constraint).
  - AC.9 codifies the dev-escape (JWT_REQUIRED=false) so green commit
    can ship in a transitional state where some integration tests run
    without IdP wiring.

Other ACs (.2/.3/.4/.5/.6/.8) need a real JWT to test, which means
either bundling a JWT library at red time (defeats the "minimal red"
discipline) or generating tokens with `python -c "import jwt; ..."` in
the test which is what the green commit will set up. Those ACs land in
the green commit, not red.
"""

from __future__ import annotations

from typing import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Fresh TestClient per test. Imports inside fixture so any
    JWT_REQUIRED env-var manipulation in a test body takes effect at
    module-import time on the next fixture call."""
    from copilot_api.main import app

    yield TestClient(app)


# ─── AC-S003-VS19.1 — Unauthenticated request returns 401 ───────────────
class TestUnauthenticatedReturns401:
    """Calling protected endpoints without an Authorization header MUST
    return 401 Unauthorized. Today this returns 200/422 because no auth
    dependency is wired."""

    @pytest.mark.parametrize(
        "endpoint,payload",
        [
            ("/ask", {"question": "Which beam is degrading?"}),
            ("/explain", {"question": "Why is beam-1 unhealthy?"}),
            ("/runbook", {"scenario_id": "beam-degradation-001"}),
        ],
    )
    def test_protected_endpoint_without_auth_returns_401(
        self, client: TestClient, endpoint: str, payload: dict
    ) -> None:
        response = client.post(endpoint, json=payload)
        assert response.status_code == 401, (
            f"{endpoint} returned {response.status_code} without auth; "
            f"expected 401 per AC-S003-VS19.1. Body: {response.text[:200]}"
        )


# ─── AC-S003-VS19.7 — /healthz and /metrics stay public ──────────────────
class TestHealthAndMetricsPublic:
    """K8s liveness/readiness probes hit /healthz; Prometheus scrapes
    /metrics. Both MUST remain public — auth on these breaks ops infra.
    SPEC-S003-VS19 §6 codifies this as a non-negotiable constraint."""

    def test_healthz_without_auth_returns_200(self, client: TestClient) -> None:
        response = client.get("/healthz")
        assert response.status_code == 200, (
            f"/healthz returned {response.status_code} without auth; "
            f"expected 200 per AC-S003-VS19.7."
        )

    def test_metrics_without_auth_returns_200(self, client: TestClient) -> None:
        response = client.get("/metrics")
        # /metrics is a Prometheus exposition endpoint exposed by
        # prometheus-fastapi-instrumentator at module load. If it's not
        # mounted (e.g. instrumentator was removed) the test still has
        # the right intent: any unauthenticated GET on /metrics must not
        # be 401/403.
        assert response.status_code in (200, 404), (
            f"/metrics returned {response.status_code} without auth; "
            f"expected 200 (instrumented) or 404 (not mounted) per "
            f"AC-S003-VS19.7. 401/403 means auth was added — that "
            f"breaks Prometheus scrape."
        )


# ─── AC-S003-VS19.9 — JWT_REQUIRED=false disables auth (dev escape) ──────
class TestJwtRequiredFalseDisablesAuth:
    """Setting env JWT_REQUIRED=false MUST allow the protected endpoints
    to respond without an Authorization header. This is the dev-escape
    that lets local docker-compose / pytest run without standing up an
    IdP, AND lets VS-20 perf-smoke run before VS-19 full UI flow lands.

    Note on test isolation: copilot_api.main reads JWT_REQUIRED at
    module import. We import inside the test body after setting env to
    avoid stale module state. The fixture client (above) is shadowed
    by a fresh client built post-env-set; the autouse fixture in
    test_copilot_api.py also resets module state between tests.
    """

    def test_jwt_required_false_allows_unauth_post_ask(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("JWT_REQUIRED", "false")
        # Force a fresh import so the env-var read at import time picks
        # up our monkeypatched value.
        import importlib
        import copilot_api.main as main_module

        importlib.reload(main_module)

        client = TestClient(main_module.app)
        response = client.post("/ask", json={"question": "anything"})
        # When auth is disabled, /ask should reach its handler and respond
        # 200 (or 422 if the body validation fails — but NOT 401/403).
        assert response.status_code != 401, (
            "JWT_REQUIRED=false should disable auth; got 401. "
            "Per AC-S003-VS19.9, env opt-out must skip verify_jwt."
        )
        assert response.status_code != 403, (
            "JWT_REQUIRED=false should disable auth; got 403."
        )

    def test_jwt_required_default_true(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Defence: JWT_REQUIRED must default to true if not set, so a
        forgotten env-var doesn't ship copilot-api auth-disabled into
        production. Per SPEC-S003-VS19 §5.1 default."""
        monkeypatch.delenv("JWT_REQUIRED", raising=False)
        import importlib
        import copilot_api.main as main_module

        importlib.reload(main_module)

        client = TestClient(main_module.app)
        response = client.post("/ask", json={"question": "anything"})
        assert response.status_code in (401, 403), (
            f"JWT_REQUIRED unset should default to enforcing auth; "
            f"/ask returned {response.status_code}. Per "
            f"AC-S003-VS19.9 default behavior must be auth-enforced."
        )
