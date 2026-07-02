"""Project-root conftest — fixtures active for ALL test directories.

VS-19 auth bypass:
  /ask, /explain, /runbook now require a valid RS256 JWT.  Tests that are
  not specifically testing the auth layer need the dependency bypassed so
  they keep exercising business logic (grounding, hallucination, injection).

  The autouse fixture below applies to every collected test.  It skips the
  override for tests in test_auth_jwt.py (they manage JWT_REQUIRED via
  monkeypatch and must exercise the real verify_jwt).  For every other test
  it injects a stub via FastAPI's dependency_overrides mechanism — the
  idiomatic FastAPI testing pattern (not a global env-var disable).

Conftest collision workaround (pytest_configure below):
  Both `tests/conftest.py` and `services/copilot-api/tests/conftest.py` are
  empty stubs. Both resolve to the pytest module name `tests.conftest` because
  the `copilot-api` directory name contains a hyphen (not a valid Python
  identifier), so pytest's `resolve_package_path` anchors at `tests/` for
  both. We patch `_importconftest` to return a fresh anonymous module for the
  service-level stub so that pluggy never sees a double-registration.
"""

from __future__ import annotations

import types
from collections.abc import Iterator
from typing import Any

import pytest


def pytest_configure(config: pytest.Config) -> None:
    """Prevent 'Plugin already registered' from stub conftest name collision.

    Patches the plugin manager's _importconftest so that the empty stub at
    services/copilot-api/tests/conftest.py gets a fresh module object rather
    than the cached tests.conftest from tests/conftest.py. Pluggy then
    registers them under different keys without error.
    """
    pm = config.pluginmanager
    _orig_import = pm._importconftest

    def _patched_importconftest(
        conftestpath: Any, importmode: Any, rootpath: Any, **kwargs: Any
    ) -> Any:
        path_str = str(conftestpath)
        if path_str.endswith("copilot-api/tests/conftest.py"):
            # Return a fresh empty module — stub has no fixtures; root conftest
            # provides all test infrastructure. Gives pluggy a unique object so
            # it can register it under the service path without collision.
            unique_key = f"_stub_conftest_{hash(path_str) & 0xFFFFFF}"
            mod = types.ModuleType(unique_key)
            mod.__file__ = path_str
            return mod
        return _orig_import(conftestpath, importmode, rootpath, **kwargs)

    pm._importconftest = _patched_importconftest


@pytest.fixture(autouse=True)
def _bypass_auth_for_non_jwt_tests(request: pytest.FixtureRequest) -> Iterator[None]:
    """Override verify_jwt for all tests except test_auth_jwt.py.

    Auth tests opt out via nodeid check and exercise the real verify_jwt.
    All other tests receive a stub that returns a minimal valid payload so
    the auth dependency is satisfied without needing a real IdP or signing
    key — mirrors AC-S003-VS19.13 "after fixture injects bearer token".
    """
    if "test_auth_jwt" in request.node.nodeid:
        yield
        return

    try:
        from copilot_api._auth import verify_jwt
        from copilot_api.main import app
    except ImportError:
        # Non-copilot tests (schema-drift, scenario-generator, k8s-smoke…).
        yield
        return

    app.dependency_overrides[verify_jwt] = lambda: {
        "sub": "test-user",
        "auth_bypassed_in_test": True,
    }
    yield
    app.dependency_overrides.pop(verify_jwt, None)
