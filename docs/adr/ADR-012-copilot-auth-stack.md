# ADR-012 — copilot-api Auth Stack (PyJWT RS256 + JWKS)

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-07-02 |
| Deciders | architect, llm-copilot-engineer, security-reviewer |
| Sprint | Sprint-4 (VS-19) |

## Context

copilot-api (`/ask`, `/explain`, `/runbook`, `/healthz`) was fully public — any caller could trigger LLM inference and anomaly explanation. Sprint-4 task VS-19 adds JWT authentication so that:

1. Only authenticated operators can invoke copilot endpoints in production.
2. The auth mechanism is provider-agnostic (any OIDC IdP — Keycloak, Dex, Auth0 — works without code change).
3. The P0 dev loop remains frictionless (`JWT_REQUIRED=false` escape hatch).

Key design constraints surfaced during VS-19 spec work:

- **Algorithm confusion (CVE-2015-9235 class)**: libraries that accept `alg` from the JWT header without validation allow an attacker to switch `RS256` → `HS256` and sign with the public key as the HMAC secret, bypassing verification entirely. This must be blocked at the decode call-site.
- **Kid rotation**: JWKS sets rotate keys (kid changes) without changing the JWKS URL. A long-lived cache cannot serve a newly-rotated key. A refetch-on-cache-miss strategy is required (Chain #5 guard: first-call-only is the anti-pattern here — we must retry on unknown kid).
- **Cold-start resilience**: if the IdP is unreachable on pod start, the service should serve requests using a stale but valid last-known-good JWKS rather than going fully 401.
- **Test isolation**: production `Depends()` injection must be overridable in unit tests without monkey-patching module globals.

## Decision

### Library

**PyJWT 2.13.0+** with the `[crypto]` extra (`pip install PyJWT[crypto]`). The `[crypto]` extra pulls in `cryptography` for RSA key parsing from JWKS JWK representations.

Rationale: PyJWT is the most actively maintained Python JWT library with a clean CVE record in the 2.x lineage. The `[crypto]` extra is the documented path for RS256; no additional JWK-parsing library is needed.

### Algorithm policy

**RS256 only.** Before every `jwt.decode()` call, the implementation checks the `alg` header field explicitly:

```python
header = jwt.get_unverified_header(token)
if header.get("alg") != "RS256":
    raise HTTPException(status_code=401, detail="Unsupported algorithm")
```

This check runs *before* `jwt.decode()` is called, so `algorithms=["RS256"]` passed to decode is a belt-and-suspenders defence, not the primary gate. `alg=none` and `HS256` are blocked unconditionally.

### JWKS cache design

```
JWT_JWKS_URL (env var)  →  JwksCache (module-level singleton)
  ├── cache TTL: 1 h (configurable via JWKS_CACHE_TTL_SECONDS)
  ├── lock: threading.RLock (async variant: asyncio.Lock for httpx)
  ├── on cache hit: return cached JWK set immediately
  ├── on cache miss (TTL expired or cold start): fetch via httpx, update cache + timestamp
  ├── on kid-not-found in cached set: refetch once, then raise 401 on second miss
  └── on fetch failure: return last-known-good JWKS if age < JWKS_GRACE_SECONDS (3600 s default)
```

The kid-rotation path (refetch-on-cache-miss) satisfies Chain #5: the cache is **not** populated exactly once on first call; it is populated lazily and refreshed whenever a kid arrives that is not in the current cache.

### FastAPI integration

```python
async def get_current_principal(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
) -> dict:
    ...

@router.post("/ask")
async def ask(
    body: AskRequest,
    principal: dict = Depends(get_current_principal),
):
    ...
```

`get_current_principal` is the single source of auth logic. Tests override it via `app.dependency_overrides[get_current_principal] = lambda: {"sub": "test-user"}` — no monkey-patching, no `unittest.mock.patch` on module globals.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `JWT_REQUIRED` | `true` | Set to `false` in dev/CI to bypass auth |
| `JWT_JWKS_URL` | _(required when JWT_REQUIRED=true)_ | OIDC provider JWKS endpoint |
| `JWT_AUDIENCE` | `orbitops-copilot` | Expected `aud` claim |
| `JWT_ISSUER` | _(required when JWT_REQUIRED=true)_ | Expected `iss` claim |
| `JWKS_CACHE_TTL_SECONDS` | `3600` | How long to reuse a cached JWKS set |
| `JWKS_GRACE_SECONDS` | `3600` | How long stale JWKS is accepted on IdP failure |

## Consequences

**Positive:**

- Standard OpenID Connect compatible. Any OIDC-compliant IdP (Keycloak, Dex, Auth0, GitHub OIDC, AWS Cognito) works without code changes — only the three env vars change.
- Algorithm confusion attacks (CVE-2015-9235 class) are blocked at the header check, before PyJWT decodes. The explicit `alg` guard is tested in `tests/unit/test_auth.py::test_algorithm_confusion_blocked`.
- `JWT_REQUIRED=false` means the Sprint-4 dev loop and CI golden tests do not require a running IdP. The escape hatch is clearly named (not a silent default-off feature).
- `app.dependency_overrides` is the standard FastAPI test isolation pattern — no test-specific code paths in production modules.

**Negative:**

- Adds `httpx` as a production dependency (already present for LLM provider calls in Sprint-3; no new dependency).
- A cold-start pod with an empty cache and a down IdP will return 401 to all authenticated requests until the IdP recovers. Grace-period buffer (last-known-good) mitigates extended IdP outages but not the first startup.
- RS256 key management (generate, rotate, distribute) now belongs to the IdP operator. In the Sprint-4 sandbox this is documented as a setup prerequisite; in Sprint-5+ it should be automated via Kubernetes Secret + cert-manager or ESO.

**Mitigation:**

- `JWT_REQUIRED=false` for dev and CI.
- Last-known-good JWKS grace period (1 h) for transient IdP failure after a successful initial fetch.
- Startup probe should check `/healthz` (which bypasses auth), not an authed endpoint, so pod readiness is not blocked by IdP downtime.

## Alternatives considered

1. **python-jose** — Rejected. Slower release cadence; `python-jose` had CVE-2024-33664 (algorithm confusion in RS/HS confusion path) in early 2024. PyJWT 2.x has a clean post-2022 record and is more actively maintained.

2. **authlib** — Rejected. `authlib` is a full OAuth 2.0 + OIDC client/server library. We need only JWT validation on the server side; pulling in the full OAuth stack adds unnecessary surface area and complexity.

3. **Shared secret (HS256)** — Rejected. Symmetric key distribution is a solved-problem trap: the secret must be shared with every client that issues tokens, which in an OIDC world means the IdP signs with its private key and the service validates with the public key. HS256 would require copilot-api to hold the same secret as the IdP, making a server-side compromise catastrophic (attacker can mint arbitrary tokens).

4. **No auth / API-key-only** — Rejected. API keys are bearer tokens with no expiry by design; compromised keys require manual rotation. OIDC JWTs have short expiry (`exp` claim) and can be revoked via kid rotation (remove the key from JWKS). API keys remain an option for machine-to-machine P1 use cases (separate ADR).

## References

- SPEC-S003-VS19: `docs/specs/SPEC-S003-VS19-oidc-jwt-auth.md`
- AC-S003-VS19: `docs/acceptance/AC-S003-VS19-oidc-jwt-auth.md`
- Red commit: `31e93c1` (failing tests for OIDC + JWT auth on copilot-api)
- CVE-2015-9235: JWT `alg=none` / algorithm confusion (original JWT library advisory)
- PyJWT docs: https://pyjwt.readthedocs.io/en/stable/usage.html#encoding-decoding-tokens-with-rs256-rsa
