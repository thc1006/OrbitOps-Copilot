# AC-S003-2 — copilot-api OIDC + JWT auth

| Field | Value |
|---|---|
| Parent SPEC | SPEC-S003-2 |
| Sprint | 4 (VS-19) |
| Status | Draft (2026-05-08) |

## Test surfaces

- `services/copilot-api/tests/test_auth.py` (NEW): auth-specific unit + integration tests
- `services/copilot-api/tests/test_existing_routes_with_auth.py` (NEW): re-runs grounding/hallucination/injection tests with auth enabled
- `services/digital-twin-ui/src/pages/Login.test.tsx` (NEW)
- `services/digital-twin-ui/src/services/api.test.ts` (NEW): axios interceptor tests
- `tests/contracts/copilot-response.schema.json`: **unchanged** (auth is orthogonal to response shape)

## ACs

### AC-S003-2.1 — Unauthenticated request returns 401
**Given** copilot-api running with `JWT_REQUIRED=true`,
**When** client calls `GET /ask` without `Authorization` header,
**Then** response is HTTP 401 with body `{"status":"unauthenticated","error":"missing_authorization_header"}`.

### AC-S003-2.2 — Valid JWT returns 200 (existing behavior preserved)
**Given** copilot-api running, JWT signed by mock-oauth2-server with `aud=orbitops-copilot` and unexpired `exp`,
**When** client calls `POST /ask` with `Authorization: Bearer <jwt>`,
**Then** response is HTTP 200 with `CopilotResponse` matching `copilot-response.schema.json` (same evidence schema as pre-auth).

### AC-S003-2.3 — Expired JWT returns 401
**Given** JWT with `exp` < now() − leeway,
**When** client calls protected route,
**Then** response is HTTP 401 with `error="token_expired"`.

### AC-S003-2.4 — Wrong audience returns 403
**Given** JWT with `aud="someone-else"`,
**When** client calls protected route,
**Then** response is HTTP 403 with `error="audience_mismatch"`.

### AC-S003-2.5 — `alg=none` token rejected
**Given** unsigned JWT with `alg=none` header,
**When** client calls protected route,
**Then** response is HTTP 401 with `error="algorithm_not_allowed"`. **Specifically prevents CVE-2015-9235-class downgrade attacks.**

### AC-S003-2.6 — `alg=HS256` token rejected
**Given** JWT signed with HS256 + JWKS public key as the secret (classic alg-confusion attack),
**When** client calls protected route,
**Then** response is HTTP 401 with `error="algorithm_not_allowed"`.

### AC-S003-2.7 — `/healthz` and `/metrics` stay public
**Given** copilot-api with `JWT_REQUIRED=true`,
**When** any client (no `Authorization` header) calls `GET /healthz` or `GET /metrics`,
**Then** response is HTTP 200. (Critical: K8s liveness probe + Prometheus scrape MUST work without token.)

### AC-S003-2.8 — JWKS rotation is honored
**Given** copilot-api has cached JWKS for kid `k1`,
**When** mock-oauth2-server rotates to `k2` and issues a new JWT signed with `k2`,
**Then** copilot-api refetches JWKS on first 401-from-cache and accepts the new JWT (no manual restart). Anti-pattern Chain #5 enforcement.

### AC-S003-2.9 — `JWT_REQUIRED=false` disables verify (dev escape)
**Given** `JWT_REQUIRED=false`,
**When** client calls protected route without token,
**Then** response is HTTP 200. Audit log records `auth_skipped=true`.

### AC-S003-2.10 — UI login flow stores token in localStorage
**Given** UI `/login` page rendered,
**When** user submits `username=demo`, `password=demo`,
**Then** axios call to `mock-oidc:9090/orbitops/token` returns `access_token`; UI stores it under `localStorage.orbitops_token`; navigates to `/`.

### AC-S003-2.11 — UI axios request interceptor injects bearer
**Given** `localStorage.orbitops_token` is set,
**When** any service module (e.g., `metricsService.askCopilot`) makes a request,
**Then** the axios interceptor adds `Authorization: Bearer ${token}` header. Verified by mocking axios + asserting header contents.

### AC-S003-2.12 — UI 401 response clears token and redirects
**Given** UI has a token in localStorage,
**When** any axios call returns 401,
**Then** the response interceptor clears `localStorage.orbitops_token` and the page navigates to `/login`. (Mirrors nycu-bus-admin auth pattern.)

### AC-S003-2.13 — Existing grounding/hallucination/injection tests still green with auth
**Given** auth enabled,
**When** `pytest services/copilot-api/tests -q -v` runs,
**Then** all pre-existing tests pass (after fixture injects bearer token). Specifically:
- `test_grounding_*`: still asserts `metrics_used` non-empty for OK status.
- `test_hallucination_*`: still asserts `INSUFFICIENT_EVIDENCE` for empty-metrics path.
- `test_injection_*`: still asserts user prompt sanitization independent of auth state.

### AC-S003-2.14 — Total test count uplift
**Given** Sprint-4 close,
**When** `pytest services/copilot-api/tests -q` runs,
**Then** total ≥ 109 (current Sprint-3 baseline) + 13 new auth tests = ≥ 122 passing.

### AC-S003-2.15 — Anti-pattern self-audit on PR
**Given** PR closing this AC,
**When** `/review` runs,
**Then** PR body has all 7 chains + Chain #X filled (Chain #1 grep-verify on PyJWT version pin; Chain #5 JWKS rotation test exists).

## Out-of-scope (Sprint-5+)

- Token refresh + revocation list
- Multi-tenant claims (tenant_id, org_id)
- K8s ServiceAccount-token-based auth (closed-loop GitOps direction)
- Rate limiting per `sub` (current impl: rate limit only on /ask globally, if at all)
