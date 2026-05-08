# SPEC-S003-2 — copilot-api OIDC + JWT auth

| Field | Value |
|---|---|
| Status | Draft (2026-05-08) — Sprint-4 VS-19 candidate |
| Parent | SPEC-003 (copilot-api) |
| Owner | llm-copilot-engineer + security-reviewer |
| Sprint | 4 (VS-19) |
| Depends on | SPEC-003 |
| Related ACs | AC-S003-2 |
| Research basis | `docs/00_research_2026_04.md` §"Sprint-4 技術選型 T1" (2026-05-08) |

## 1. Goal

copilot-api 從**全 public** 進入**auth-required** 狀態。所有 LLM-evidence-bearing endpoint（`/ask`、`/explain`、`/runbook`、`/providers`）必須驗證 valid RS256 JWT；K8s probe (`/healthz`) 與 Prometheus scrape (`/metrics`) 維持 public（否則破 ops infra）。digital-twin-ui 加 login flow + axios bearer interceptor，401 回應 → 清 token + redirect to login。

## 2. Non-goals

- **Full OIDC server impl**：用 navikt/mock-oauth2-server 3.0.1（Docker），不寫自己的 IdP。
- **Multi-tenancy**：JWT `sub` claim 視同 user identifier，但 copilot-api 不分租戶；evidence/scenario state 維持 process-global（既有行為）。
- **Token refresh / revocation list**：Sprint-5+。本 sprint 只做 verify。
- **K8s OIDC integration**：copilot-api 透過 sidecar / ServiceAccount token authenticate to K8s 是 Sprint-5+ closed-loop scope（見 SPEC-S006-2）。
- **Authlib / fastapi-users**：研究結果排除（前者過重，後者已停滯）。

## 3. Inputs (current state, 2026-05-08)

- copilot-api `services/copilot-api/src/copilot_api/main.py`：FastAPI 路由 `/healthz`、`/ask`、`/explain`、`/runbook`、`/providers`、`/metrics`、`/anomaly/inject`、`/scenario/load|tick`。**全部** 0 auth。
- digital-twin-ui axios baseURL → copilot-api；無 Authorization header；無 login screen。
- env vars: copilot-api 已含 `MOCK_PROVIDER_ENABLED`、`OPENAI_BASE_URL` 等；無 auth-related env。
- `pyproject.toml`：fastapi、pydantic、httpx、prometheus-client；**無** PyJWT。

## 4. Outputs (target state)

### 4.1 copilot-api server 端
- 新依賴：`PyJWT[crypto]>=2.12.1` (CVE-2026-32597 fix)
- 新 module：`services/copilot-api/src/copilot_api/_auth.py`
  - `verify_jwt(authorization: str = Header(...))` FastAPI dependency
  - 啟動時從 `JWT_JWKS_URL` 拉 JWKS，cache in-process 1h；過期重抓
  - 驗 `aud` == `JWT_AUDIENCE`，`exp` 未過，`alg` ∈ {`RS256`}（hardcoded allowlist; 拒絕 `none` / `HS256`）
- 路由 dependency 注入：
  - **Protected**: `/ask`、`/explain`、`/runbook`、`/providers`、`/anomaly/inject`、`/scenario/load|tick` → `Depends(verify_jwt)`
  - **Public**: `/healthz`、`/metrics` → 無 dependency
- Error response shape：401 `{"status":"unauthenticated","error":"<reason>"}`；403 `{"status":"forbidden","error":"<reason>"}`（既有 evidence schema 不變）

### 4.2 IdP（dev / CI）
- `docker-compose.yml` 加 service `mock-oidc`：`ghcr.io/navikt/mock-oauth2-server:3.0.1`，port 9090
- 暴露：discovery doc `http://mock-oidc:9090/orbitops/.well-known/openid-configuration`、JWKS `http://mock-oidc:9090/orbitops/jwks`、token `POST /orbitops/token`
- Issuer claim: `http://mock-oidc:9090/orbitops`
- Audience: `orbitops-copilot`
- K8s overlay: 同樣加 `mock-oidc` Deployment + Service（local overlay only；prod overlay 假設用真 IdP）

### 4.3 digital-twin-ui
- 新 page `/login`：呼叫 `POST /orbitops/token` (form login `username=demo&password=demo`)，取 `access_token`，存 `localStorage.orbitops_token`
- axios request interceptor：注入 `Authorization: Bearer ${token}`
- axios response interceptor：401 → clear token + `navigate('/login')`
- ProtectedRoute wrapper：未 authed → redirect `/login`
- i18n keys 新增：`auth.login.*`（en + zh-TW parity）

## 5. Interfaces

### 5.1 env vars (copilot-api)
```
JWT_REQUIRED=true            # default true; false 跳過 verify (dev escape)
JWT_JWKS_URL=http://mock-oidc:9090/orbitops/jwks
JWT_AUDIENCE=orbitops-copilot
JWT_ISSUER=http://mock-oidc:9090/orbitops
JWT_LEEWAY_SECONDS=10        # clock skew tolerance
```

### 5.2 JWT claims contract
| Claim | Required | Validated as |
|---|---|---|
| `iss` | yes | == `JWT_ISSUER` |
| `aud` | yes | contains `JWT_AUDIENCE` |
| `exp` | yes | > now() − leeway |
| `iat` | yes | < now() + leeway |
| `sub` | yes | non-empty string (used in audit log) |
| `alg` (header) | yes | == `RS256` (hardcoded allowlist) |

### 5.3 UI ↔ IdP flow (dev)
```
UI /login → POST mock-oidc:9090/orbitops/token (form-login demo:demo)
         ← { access_token: "<jwt>", token_type: "Bearer", expires_in: 3600 }
UI stores token, calls copilot-api /ask with Authorization: Bearer <jwt>
copilot-api verifies via JWKS → 200 + evidence response
```

## 6. Constraints

- **CVE-2026-32597 (CVSS 7.5)**: PyJWT < 2.12.0 silently accepts unknown `crit` headers. Pin `>=2.12.1` in `pyproject.toml`. CI gate: `verify.sh` checks pinned version.
- **No HS256**: hardcoded allowlist `{RS256}` only. `alg=none` and `alg=HS256` MUST be rejected (test fixture exercises both).
- **JWKS caching**: max 1h TTL; on JWKS fetch failure, **last-known good** stays valid for 1 extra hour (graceful degradation; logged at WARN).
- **`/metrics` + `/healthz` MUST stay public**: K8s liveness/readiness + Prometheus scrape break otherwise. PR template + reviewer must enforce.
- **Anti-pattern Chain #5 (first-call-only)**: JWKS cache MUST refresh on key rotation; not "load once forever". Test: simulate kid change, expect 401 → refetch → 200.
- **Anti-pattern Chain #4 (NaN guard)**: `exp` claim MAY be string; coerce to int with `Number.isFinite` analogue (`isinstance(int)` + range check) before `time.time()` compare.
- **Backwards compat path**: `JWT_REQUIRED=false` env disables auth (dev mode). Production overlay sets `JWT_REQUIRED=true` (default) and CI test overlay also sets true. **Local docker-compose dev** stays auth-on by default to catch missing-token bugs early.

## 7. Open questions (resolve at ADR-012 commit time)

1. **JWT issuer URL in production**: stays `mock-oidc` for demo? Or pluggable to a real IdP (Auth0, Keycloak, etc.) by changing env? → SPEC says "pluggable; demo uses mock-oidc; prod overlay env can override".
2. **Token expiry policy**: 1h (mock-oauth2-server default) — too short for live demo? Re-login UX during demo is annoying. Consider 8h dev-only.
3. **UI login UX**: full-page login vs modal? Just static-token-injection for demo simplicity? **Recommendation**: full-page `/login` (mirrors nycu-bus-admin pattern) — re-uses existing ProtectedRoute idiom.
4. **CI test fixture**: pre-baked JWT signed with mock-oauth2-server's static key? Or runtime-call `/token` in test setup? Latter is more realistic but slower.

## 8. Acceptance criteria

See `docs/acceptance/AC-S003-2-copilot-oidc-jwt-auth.md`.

## 9. Anti-pattern accountability

- **Chain #1 grep-verify**: every cited path / library / version in this SPEC is grep'd or PyPI-verified.
- **Chain #3 cross-page alignment**: i18n keys for `auth.login.*` will go in both `en.json` + `zh-TW.json` (REQUIRED_KEYS extended).
- **Chain #5 first-call-only**: JWKS cache test exercises kid rotation.
- **Chain #6 partial-migration**: not adding auth to **only some** protected routes; the protect-list is exhaustive (§4.1).

## 10. Sources

See `docs/00_research_2026_04.md` §"Sprint-4 技術選型 T1" (2026-05-08); 6 citations including CVE advisory, PyJWT PyPI, navikt/mock-oauth2-server releases.
