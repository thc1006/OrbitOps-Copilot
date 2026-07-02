"""VS-19: OIDC/JWT auth dependency for copilot-api.

SPEC-S003-VS19 §4.1 — verify_jwt is a FastAPI Depends() that:
  - Reads JWT_REQUIRED at request time (not import time) so monkeypatch works.
  - Fetches JWKS from JWT_JWKS_URL; caches result for 1 h.
  - On kid miss (key rotation) forces an immediate refetch before failing (Chain #5).
  - On fetch failure uses last-known-good for 1 extra hour; logs WARN.
  - Rejects alg ∉ {RS256} before decode — prevents CVE-2015-9235 downgrade attacks.
  - Returns the decoded JWT payload dict on success.
  - Raises _JWTError on any auth failure (caught by the exception handler in main.py).

Environment variables (all read at request time):
  JWT_REQUIRED          "true" (default) | "false" — dev escape hatch
  JWT_JWKS_URL          JWKS discovery endpoint URL
  JWT_AUDIENCE          expected `aud` claim value
  JWT_ISSUER            expected `iss` claim value (skipped if empty)
  JWT_LEEWAY_SECONDS    clock-skew tolerance, default 10
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

import httpx
import jwt
from fastapi import Header
from jwt.algorithms import RSAAlgorithm

logger = logging.getLogger(__name__)

_JWKS_CACHE_TTL: float = 3600.0  # seconds before a cache entry is stale
_JWKS_GRACE_TTL: float = 3600.0  # extra seconds of grace on fetch failure

# ---------------------------------------------------------------------------
# Thread-safe JWKS cache
# ---------------------------------------------------------------------------
_lock = threading.RLock()
_jwks_cache: dict[str, Any] = {}  # kid → RSA public-key object
_jwks_fetched_at: float = 0.0  # epoch of last *successful* fetch
_jwks_last_known: dict[str, Any] = {}  # fallback used during IdP outage


# ---------------------------------------------------------------------------
# Cache primitives — kept as module-level functions so tests can patch them
# ---------------------------------------------------------------------------


def _do_fetch() -> dict[str, Any]:
    """HTTP-fetch JWKS from JWT_JWKS_URL → {kid: RSA_public_key}.

    Returns {} when JWT_JWKS_URL is not configured (tests / JWT_REQUIRED=false).
    Raises on network or HTTP errors so the caller can decide on grace fallback.
    """
    url = os.environ.get("JWT_JWKS_URL", "").strip()
    if not url:
        return {}
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    data = resp.json()
    keys: dict[str, Any] = {}
    for jwk in data.get("keys", []):
        kid = str(jwk.get("kid", "default"))
        keys[kid] = RSAAlgorithm.from_jwk(jwk)
    return keys


def _reset_jwks_cache() -> None:
    """Test helper — clear cache so next request triggers a fresh fetch."""
    global _jwks_fetched_at
    with _lock:
        _jwks_cache.clear()
        _jwks_last_known.clear()
        _jwks_fetched_at = 0.0


def _inject_jwks(keys: dict[str, Any]) -> None:
    """Test helper — seed the cache with pre-built RSA public-key objects.

    Sets _jwks_fetched_at to +inf so the cache never auto-expires during a
    test run, yet a kid-miss still triggers a refetch (Chain #5 path).
    """
    global _jwks_fetched_at
    with _lock:
        _jwks_cache.clear()
        _jwks_cache.update(keys)
        _jwks_last_known.clear()
        _jwks_last_known.update(keys)
        _jwks_fetched_at = float("inf")


def _get_public_key(kid: str) -> Any | None:
    """Return the RSA public key for *kid*, refetching on cache miss.

    AC-S003-VS19.8 / Chain #5: a kid not present in a *fresh* cache triggers
    an immediate refetch (key rotation); returns None only if the kid is absent
    even after the refetch.
    """
    global _jwks_fetched_at
    now = time.time()

    with _lock:
        cache_age = now - _jwks_fetched_at
        cache_fresh = cache_age < _JWKS_CACHE_TTL

        # Fast path: cache is fresh AND kid is present.
        if cache_fresh and kid in _jwks_cache:
            return _jwks_cache[kid]

        # Slow path: stale cache OR kid absent (possible rotation) → fetch.
        try:
            new_keys = _do_fetch()
            _jwks_cache.clear()
            _jwks_cache.update(new_keys)
            _jwks_last_known.clear()
            _jwks_last_known.update(new_keys)
            _jwks_fetched_at = now
        except Exception as exc:
            within_grace = cache_age < (_JWKS_CACHE_TTL + _JWKS_GRACE_TTL)
            logger.warning(
                "JWKS fetch failed (within_grace=%s); using last-known-good. err=%s",
                within_grace,
                exc,
            )
            if not within_grace:
                raise

        return _jwks_cache.get(kid)


# ---------------------------------------------------------------------------
# Custom exception — lets main.py return the exact error body from SPEC §4.1
# ---------------------------------------------------------------------------


class _JWTError(Exception):
    """Auth failure.  Caught by the exception handler registered in main.py."""

    def __init__(self, status_code: int, status_str: str, error: str) -> None:
        self.status_code = status_code
        self.status_str = status_str
        self.error = error


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def verify_jwt(authorization: str | None = Header(default=None)) -> dict:  # type: ignore[type-arg]
    """Validate the RS256 JWT bearer token from the Authorization header.

    All env vars are read at call time — safe for monkeypatch in tests.
    """
    jwt_required = os.environ.get("JWT_REQUIRED", "true").lower() != "false"
    if not jwt_required:
        # Dev escape: audit log can later key off auth_skipped=True.
        return {"sub": "anonymous", "auth_skipped": True}

    # ── 1. Header present and well-formed ───────────────────────────────────
    if authorization is None:
        raise _JWTError(401, "unauthenticated", "missing_authorization_header")

    if not authorization.startswith("Bearer "):
        raise _JWTError(401, "unauthenticated", "invalid_authorization_scheme")

    token = authorization[7:]

    # ── 2. Algorithm check BEFORE decode (prevents alg=none / HS256 attacks) ─
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise _JWTError(401, "unauthenticated", "malformed_token")

    alg = header.get("alg", "")
    if alg not in {"RS256"}:
        # Covers alg=none (CVE-2015-9235) and alg=HS256 confusion attacks.
        raise _JWTError(401, "unauthenticated", "algorithm_not_allowed")

    kid = str(header.get("kid", "default"))

    # ── 3. Resolve public key (may trigger JWKS refetch on rotation) ────────
    try:
        public_key = _get_public_key(kid)
    except Exception:
        raise _JWTError(401, "unauthenticated", "jwks_unavailable")

    if public_key is None:
        raise _JWTError(401, "unauthenticated", "unknown_key_id")

    # ── 4. Decode + verify signature, exp, iat, aud, iss ───────────────────
    audience = os.environ.get("JWT_AUDIENCE", "orbitops-copilot")
    issuer_env = os.environ.get("JWT_ISSUER", "").strip()
    issuer: str | None = issuer_env or None
    try:
        leeway = int(os.environ.get("JWT_LEEWAY_SECONDS", "10"))
    except ValueError:
        leeway = 10

    required_claims = ["exp", "iat", "sub"]
    if issuer:
        required_claims.append("iss")

    try:
        payload: dict = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            leeway=leeway,
            options={"require": required_claims},
        )
    except jwt.ExpiredSignatureError:
        raise _JWTError(401, "unauthenticated", "token_expired")
    except jwt.InvalidAudienceError:
        raise _JWTError(403, "forbidden", "audience_mismatch")
    except jwt.InvalidIssuerError:
        raise _JWTError(401, "unauthenticated", "invalid_issuer")
    except jwt.MissingRequiredClaimError as exc:
        raise _JWTError(401, "unauthenticated", f"missing_claim_{exc.claim}")
    except jwt.DecodeError:
        raise _JWTError(401, "unauthenticated", "malformed_token")
    except jwt.InvalidTokenError as exc:
        # Catch-all for any other PyJWT validation failure.
        raise _JWTError(401, "unauthenticated", str(exc))

    # ── 5. Chain #4 NaN / empty-string guard on sub ─────────────────────────
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise _JWTError(401, "unauthenticated", "missing_sub_claim")

    return payload
