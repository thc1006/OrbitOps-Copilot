"""SPEC-S003-VS19 — OIDC + JWT auth tests (red + green phases).

RED phase (AC.1, AC.7, AC.9) — committed before any implementation.
GREEN phase (AC.2, AC.3, AC.4, AC.5, AC.6, AC.8) — committed after
_auth.py and the Depends(verify_jwt) wiring landed.

Red-phase rationale:
  - AC.1 alone passes trivially with `if Authorization is None: 401` —
    a straw-man impl could green it without doing real JWT work.
  - AC.7 prevents the next contributor from "fixing" AC.1 by globally
    requiring auth (which would break /healthz K8s probes + /metrics
    Prometheus scrape; SPEC §6 explicit constraint).
  - AC.9 codifies the dev-escape (JWT_REQUIRED=false) so green commit
    can ship in a transitional state where some integration tests run
    without IdP wiring.

Green-phase rationale:
  - Generates real RSA-2048 keypairs in-process; seeds the _auth.py JWKS
    cache via _inject_jwks() so no HTTP call to any IdP is made.
  - Uses PyJWT to sign tokens with controlled claims so expiry, audience,
    algorithm, and kid can be exercised deterministically.
  - _reset_jwks_cache() runs in fixture teardown so tests are isolated.
"""

from __future__ import annotations

import time
from collections.abc import Generator, Iterator
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Fresh TestClient per test. Imports inside fixture so any
    JWT_REQUIRED env-var manipulation in a test body takes effect at
    module-import time on the next fixture call."""
    from copilot_api.main import app

    yield TestClient(app)


@pytest.fixture
def rsa_keypair() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    """Generate a fresh RSA-2048 keypair for each test.  The pair is used to
    sign tokens (private) and to seed the JWKS cache (public)."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    return private_key, private_key.public_key()


@pytest.fixture(autouse=False)
def _clean_jwks_cache() -> Generator[None, None, None]:
    """Reset the module-level JWKS cache before and after every JWT test so
    no state leaks between parametrized cases."""
    from copilot_api._auth import _reset_jwks_cache

    _reset_jwks_cache()
    yield
    _reset_jwks_cache()


# ---------------------------------------------------------------------------
# Helper — build a valid token with caller-controlled overrides
# ---------------------------------------------------------------------------


def _make_token(
    private_key: rsa.RSAPrivateKey,
    *,
    kid: str = "kid-test",
    algorithm: str = "RS256",
    aud: str = "orbitops-copilot",
    iss: str = "test-issuer",
    sub: str = "user@example.com",
    exp_offset: int = 3600,
    extra_headers: dict | None = None,
) -> str:
    """Return a signed JWT string.  exp_offset < 0 produces an expired token."""
    now = int(time.time())
    payload = {
        "sub": sub,
        "aud": aud,
        "iss": iss,
        "iat": now - 1,
        "exp": now + exp_offset,
    }
    headers: dict = {"kid": kid}
    if extra_headers:
        headers.update(extra_headers)
    return jwt.encode(payload, private_key, algorithm=algorithm, headers=headers)


# ---------------------------------------------------------------------------
# AC-S003-VS19.1 — Unauthenticated request returns 401
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# AC-S003-VS19.7 — /healthz and /metrics stay public
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# AC-S003-VS19.9 — JWT_REQUIRED=false disables auth (dev escape)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# AC-S003-VS19.2 — Valid RS256 JWT → protected endpoints return 200
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_clean_jwks_cache")
class TestValidJwtReturns200:
    """A well-formed RS256 JWT with a valid signature, non-expired exp, and
    correct audience MUST let the request reach the handler (HTTP 200).
    The handler may return INSUFFICIENT_EVIDENCE if no metrics are injected,
    but the HTTP status code must not be 401 or 403.

    Per AC-S003-VS19.2.
    """

    @pytest.mark.parametrize(
        "endpoint,payload",
        [
            ("/ask", {"question": "Which beam is degrading?"}),
            # /explain and /runbook use ExplainRequest: {anomaly_type, metrics_snapshot}
            ("/explain", {"anomaly_type": "beam-degradation", "metrics_snapshot": []}),
            ("/runbook", {"anomaly_type": "beam-degradation", "metrics_snapshot": []}),
        ],
    )
    def test_valid_token_reaches_handler(
        self,
        client: TestClient,
        rsa_keypair: tuple,
        monkeypatch: pytest.MonkeyPatch,
        endpoint: str,
        payload: dict,
    ) -> None:
        from copilot_api._auth import _inject_jwks

        private_key, public_key = rsa_keypair
        _inject_jwks({"kid-test": public_key})

        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")

        token = _make_token(private_key)
        resp = client.post(
            endpoint, json=payload, headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, (
            f"{endpoint} with valid RS256 JWT returned {resp.status_code}; "
            f"expected 200 per AC-S003-VS19.2. Body: {resp.text[:300]}"
        )


# ---------------------------------------------------------------------------
# AC-S003-VS19.3 — Expired token → 401 token_expired
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_clean_jwks_cache")
class TestExpiredTokenReturns401:
    """A token whose exp claim is in the past (beyond leeway) MUST be
    rejected with 401 and error code 'token_expired'.

    Per AC-S003-VS19.3.
    """

    def test_expired_token_returns_401_token_expired(
        self,
        client: TestClient,
        rsa_keypair: tuple,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from copilot_api._auth import _inject_jwks

        private_key, public_key = rsa_keypair
        _inject_jwks({"kid-test": public_key})

        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")
        # Set leeway to 0 so there is no grace period for the expired token.
        monkeypatch.setenv("JWT_LEEWAY_SECONDS", "0")

        # exp_offset=-3600 places the expiry 1 hour in the past.
        token = _make_token(private_key, exp_offset=-3600)
        resp = client.post(
            "/ask",
            json={"question": "anything"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401, (
            f"Expected 401 for expired token, got {resp.status_code}. "
            f"Body: {resp.text[:300]}"
        )
        body = resp.json()
        assert body.get("error") == "token_expired", (
            f"Expected error='token_expired', got {body!r}"
        )
        assert body.get("status") == "unauthenticated", (
            f"Expected status='unauthenticated', got {body!r}"
        )


# ---------------------------------------------------------------------------
# AC-S003-VS19.4 — Wrong audience → 403 audience_mismatch
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_clean_jwks_cache")
class TestWrongAudienceReturns403:
    """A token with an audience claim that does not match JWT_AUDIENCE MUST
    be rejected with 403 and error code 'audience_mismatch'.

    Per AC-S003-VS19.4.
    """

    def test_wrong_audience_returns_403_audience_mismatch(
        self,
        client: TestClient,
        rsa_keypair: tuple,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from copilot_api._auth import _inject_jwks

        private_key, public_key = rsa_keypair
        _inject_jwks({"kid-test": public_key})

        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")

        # Token has a different audience — should not match JWT_AUDIENCE.
        token = _make_token(private_key, aud="wrong-audience")
        resp = client.post(
            "/ask",
            json={"question": "anything"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403, (
            f"Expected 403 for audience mismatch, got {resp.status_code}. "
            f"Body: {resp.text[:300]}"
        )
        body = resp.json()
        assert body.get("error") == "audience_mismatch", (
            f"Expected error='audience_mismatch', got {body!r}"
        )
        assert body.get("status") == "forbidden", (
            f"Expected status='forbidden', got {body!r}"
        )


# ---------------------------------------------------------------------------
# AC-S003-VS19.5 — Malformed token (garbage string) → 401 malformed_token
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_clean_jwks_cache")
class TestMalformedTokenReturns401:
    """Any string that is not a parseable JWT MUST be rejected with 401 and
    error code 'malformed_token'.

    Per AC-S003-VS19.5.
    """

    @pytest.mark.parametrize(
        "bad_token",
        [
            "garbage.not.a.jwt",
            "just-a-plain-string",
            "eyJhbGciOiJSUzI1NiJ9",  # header-only, no payload/sig
            "a.b",  # two parts only, missing sig
        ],
        ids=["random-garbage", "plain-string", "header-only", "two-parts"],
    )
    def test_malformed_token_returns_401(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
        bad_token: str,
    ) -> None:
        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")

        resp = client.post(
            "/ask",
            json={"question": "anything"},
            headers={"Authorization": f"Bearer {bad_token}"},
        )
        assert resp.status_code == 401, (
            f"Expected 401 for malformed token '{bad_token[:30]}', "
            f"got {resp.status_code}. Body: {resp.text[:300]}"
        )
        body = resp.json()
        assert body.get("error") == "malformed_token", (
            f"Expected error='malformed_token', got {body!r}"
        )


# ---------------------------------------------------------------------------
# AC-S003-VS19.6 — alg=HS256 token → 401 algorithm_not_allowed
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_clean_jwks_cache")
class TestHs256TokenReturns401:
    """A token signed with HS256 (symmetric) MUST be rejected before any
    key lookup — this prevents CVE-2015-9235 / algorithm confusion attacks.
    Error code MUST be 'algorithm_not_allowed'.

    Per AC-S003-VS19.6.
    """

    def test_hs256_token_rejected_before_key_lookup(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")

        # Sign with a symmetric secret — alg will be HS256.
        import time as _time

        now = int(_time.time())
        hs256_token = jwt.encode(
            {
                "sub": "attacker@evil.com",
                "aud": "orbitops-copilot",
                "iss": "evil-issuer",
                "iat": now - 1,
                "exp": now + 3600,
            },
            "super-secret-key",
            algorithm="HS256",
        )
        resp = client.post(
            "/ask",
            json={"question": "anything"},
            headers={"Authorization": f"Bearer {hs256_token}"},
        )
        assert resp.status_code == 401, (
            f"Expected 401 for HS256 token, got {resp.status_code}. "
            f"Body: {resp.text[:300]}"
        )
        body = resp.json()
        assert body.get("error") == "algorithm_not_allowed", (
            f"Expected error='algorithm_not_allowed', got {body!r}"
        )


# ---------------------------------------------------------------------------
# AC-S003-VS19.8 — Key rotation: kid not in cache → refetch → 200
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_clean_jwks_cache")
class TestKidRotationTriggersRefetch:
    """When the JWT kid is not found in the current JWKS cache, the auth
    layer MUST immediately refetch from the JWKS endpoint before rejecting
    the request.  If the refetched keys contain the kid, the request MUST
    succeed (HTTP 200 / INSUFFICIENT_EVIDENCE body).

    This exercises Chain #5 (first-call-only guard) from the anti-pattern
    checklist.  Per AC-S003-VS19.8.
    """

    def test_unknown_kid_triggers_refetch_and_succeeds(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from copilot_api._auth import _inject_jwks

        # Seed cache with an "old" key that does NOT match the incoming kid.
        old_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        _inject_jwks({"old-kid": old_private.public_key()})

        # New key that the IdP has rotated to — not yet in cache.
        new_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        new_public = new_private.public_key()

        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")

        token = _make_token(new_private, kid="new-kid")

        # Patch _do_fetch so no HTTP call is made; return the new key.
        with patch("copilot_api._auth._do_fetch", return_value={"new-kid": new_public}):
            resp = client.post(
                "/ask",
                json={"question": "Which beam is degrading?"},
                headers={"Authorization": f"Bearer {token}"},
            )

        # The handler is reached (200) even though the kid was initially absent.
        assert resp.status_code == 200, (
            f"Expected 200 after key-rotation refetch, got {resp.status_code}. "
            f"Body: {resp.text[:300]}"
        )

    def test_unknown_kid_not_in_refetched_keys_returns_401(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Complementary: if the kid is absent even after refetch, the request
        MUST be rejected with 401 / unknown_key_id (not crash or 500)."""
        from copilot_api._auth import _inject_jwks

        old_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        _inject_jwks({"old-kid": old_private.public_key()})

        new_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)

        monkeypatch.setenv("JWT_REQUIRED", "true")
        monkeypatch.setenv("JWT_AUDIENCE", "orbitops-copilot")
        monkeypatch.setenv("JWT_JWKS_URL", "")

        token = _make_token(new_private, kid="phantom-kid")

        # Refetch returns an empty set — kid is truly unknown.
        with patch("copilot_api._auth._do_fetch", return_value={}):
            resp = client.post(
                "/ask",
                json={"question": "anything"},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert resp.status_code == 401, (
            f"Expected 401 for kid absent after refetch, got {resp.status_code}. "
            f"Body: {resp.text[:300]}"
        )
        body = resp.json()
        assert body.get("error") == "unknown_key_id", (
            f"Expected error='unknown_key_id', got {body!r}"
        )
