"""FastAPI app for ntn-metrics-emulator (SPEC-002 v2 contract).

Endpoints:
    GET  /healthz
    POST /scenario/load   body: scenario JSON v2
    POST /scenario/tick   body: {"seconds": int}
    GET  /scenario/current
    GET  /metrics         Prometheus exposition

Metrics are defined per `docs/contracts/metrics.md`. Computation is a pure
function of (scenario, t); see `_compute.py`.

Hardening (M-4 + M-5 + L-2 + L-4 from internal code review):
- per-service prometheus CollectorRegistry (no collision with sibling services)
- asyncio.Lock guards mutation of `_state` and gauge labels
- /scenario/tick `seconds` clamped to [0, 86400]
- error responses uniformly `{"error": <msg>, "detail"?: ...}` via HTTPException
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Gauge,
    generate_latest,
)

from . import _compute

app = FastAPI(title="ntn-metrics-emulator", version="0.1.0")

# CORS allowlist. Driven by the `CORS_ALLOWED_ORIGINS` env var (comma-
# separated list). Defaults to `*` so a fresh local dev box works without
# extra wiring; deployment manifests in non-local clusters MUST override
# with an explicit allowlist before exposing this service via ingress.
_cors_origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "*").strip()
_cors_origins: list[str] = (
    ["*"]
    if _cors_origins_env == "*"
    else [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)


# --- per-service prometheus registry ----------------------------------------

_REGISTRY = CollectorRegistry(auto_describe=True)


_BEAM_SNR = Gauge(
    "orbitops_beam_snr_db", "Per-beam SNR in dB", ["beam_id"], registry=_REGISTRY
)
_BEAM_SINR = Gauge(
    "orbitops_beam_sinr_db", "Per-beam SINR in dB", ["beam_id"], registry=_REGISTRY
)
_LINK_LATENCY = Gauge(
    "orbitops_link_latency_ms",
    "Per-beam end-to-end link latency in ms",
    ["beam_id"],
    registry=_REGISTRY,
)
_PACKET_LOSS = Gauge(
    "orbitops_packet_loss_ratio",
    "Per-beam packet loss ratio (0..1)",
    ["beam_id"],
    registry=_REGISTRY,
)
_DOPPLER = Gauge(
    "orbitops_doppler_residual_hz",
    "Per-beam Doppler residual in Hz after compensation",
    ["beam_id"],
    registry=_REGISTRY,
)
_HANDOVER_STATE = Gauge(
    "orbitops_handover_state",
    "Handover state machine: 0=stable, 1=preparing, 2=failure",
    ["beam_id"],
    registry=_REGISTRY,
)
_GATEWAY_AVAIL = Gauge(
    "orbitops_gateway_available",
    "Gateway availability (1=healthy, 0=outage)",
    ["gateway_id"],
    registry=_REGISTRY,
)
_ANOMALY_ACTIVE = Gauge(
    "orbitops_anomaly_active",
    "1 if any event of this type is active at current t, else 0",
    ["type"],
    registry=_REGISTRY,
)
# G7 — sin-shaped elevation gauge driven by _compute.elevation_deg(scenario, t).
# Single satellite + multiple beams share the pass geometry, so each beam's
# label gets the same value at any given tick.
_BEAM_ELEVATION_DEG = Gauge(
    "orbitops_beam_elevation_deg",
    "Per-beam elevation angle in degrees (sin-shaped over the pass; 0..90)",
    ["beam_id"],
    registry=_REGISTRY,
)

_METRIC_TO_GAUGE: dict[str, Gauge] = {
    "orbitops_beam_snr_db": _BEAM_SNR,
    "orbitops_beam_sinr_db": _BEAM_SINR,
    "orbitops_link_latency_ms": _LINK_LATENCY,
    "orbitops_packet_loss_ratio": _PACKET_LOSS,
    "orbitops_doppler_residual_hz": _DOPPLER,
    "orbitops_handover_state": _HANDOVER_STATE,
    "orbitops_gateway_available": _GATEWAY_AVAIL,
    "orbitops_anomaly_active": _ANOMALY_ACTIVE,
    "orbitops_beam_elevation_deg": _BEAM_ELEVATION_DEG,
}


# --- module-level state -----------------------------------------------------

MAX_TICK_SECONDS = 86_400  # 1 day; bounded to avoid DoS via huge tick

_state: dict[str, Any] = {"scenario": None, "t": 0}
_state_lock = asyncio.Lock()


def _reset_state_for_tests() -> None:
    """Test-only: clear loaded scenario, reset t, drop all label permutations."""
    _state["scenario"] = None
    _state["t"] = 0
    for gauge in _METRIC_TO_GAUGE.values():
        gauge.clear()


# --- schema cache -----------------------------------------------------------


def _schema_path() -> Path | None:
    """Locate scenario.schema.json. Lookup order:
    1. ``ORBITOPS_CONTRACTS_DIR`` env var
    2. cwd-relative
    3. Walk upward from this file (replaces fragile parents[4] which broke
       on relocation; in containers the schema is COPYed to /app/tests/contracts).
    """
    env_dir = os.environ.get("ORBITOPS_CONTRACTS_DIR", "").strip()
    if env_dir:
        p = Path(env_dir) / "scenario.schema.json"
        if p.is_file():
            return p

    cwd_path = Path.cwd() / "tests" / "contracts" / "scenario.schema.json"
    if cwd_path.is_file():
        return cwd_path

    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "tests" / "contracts" / "scenario.schema.json"
        if candidate.is_file():
            return candidate
    return None


_SCHEMA_VALIDATOR: Draft202012Validator | None = None


def _validator() -> Draft202012Validator:
    global _SCHEMA_VALIDATOR
    if _SCHEMA_VALIDATOR is None:
        path = _schema_path()
        if path is None:
            raise RuntimeError("scenario.schema.json not found")
        schema = json.loads(path.read_text(encoding="utf-8"))
        _SCHEMA_VALIDATOR = Draft202012Validator(schema)
    return _SCHEMA_VALIDATOR


# --- metric refresh ---------------------------------------------------------


def _refresh_metrics() -> None:
    """Recompute all gauges from current state. Clears prior label values first."""
    for gauge in _METRIC_TO_GAUGE.values():
        gauge.clear()

    scenario = _state["scenario"]
    if scenario is None:
        return

    snapshot = _compute.compute(scenario, _state["t"])
    for name, samples in snapshot.items():
        gauge = _METRIC_TO_GAUGE[name]
        for labels, value in samples:
            gauge.labels(**labels).set(value)


# --- routes -----------------------------------------------------------------


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/scenario/load")
async def scenario_load(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail={"error": "body is not valid JSON"})

    if not isinstance(body, dict):
        raise HTTPException(
            status_code=400, detail={"error": "body must be a JSON object"}
        )

    try:
        _validator().validate(body)
    except ValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "scenario does not match schema",
                "message": exc.message,
                "path": list(exc.absolute_path),
            },
        )

    async with _state_lock:
        _state["scenario"] = body
        _state["t"] = 0
        _refresh_metrics()

    return {
        "loaded": body["scenario_id"],
        "t": 0,
        "beams": len(body["beams"]),
        "gateways": len(_compute.gateway_ids(body)),
    }


@app.post("/scenario/tick")
async def scenario_tick(request: Request) -> dict[str, Any]:
    if _state["scenario"] is None:
        raise HTTPException(status_code=409, detail={"error": "no scenario loaded"})

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        payload = {}
    if payload is None:
        payload = {}

    try:
        seconds = int(payload.get("seconds", 1)) if isinstance(payload, dict) else 1
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400, detail={"error": "'seconds' must be an integer"}
        )

    if seconds < 0:
        raise HTTPException(
            status_code=400, detail={"error": "'seconds' must be non-negative"}
        )
    if seconds > MAX_TICK_SECONDS:
        raise HTTPException(
            status_code=400,
            detail={"error": f"'seconds' must be ≤ {MAX_TICK_SECONDS} (1 day)"},
        )

    async with _state_lock:
        _state["t"] += seconds
        _refresh_metrics()
        t_now = _state["t"]
        active = _compute.active_anomaly_types(_state["scenario"], t_now)

    return {"t": t_now, "active_anomalies": active}


@app.get("/scenario/current")
def scenario_current() -> dict[str, Any]:
    if _state["scenario"] is None:
        raise HTTPException(status_code=404, detail={"error": "no scenario loaded"})
    return {
        "scenario_id": _state["scenario"]["scenario_id"],
        "t": _state["t"],
        "scenario": _state["scenario"],
    }


# --- VS-9a: /anomaly/inject -----------------------------------------------
# Runtime-mutates the loaded scenario's `events` list so the UI can surface
# anomalies on demand (no scenario-edit + reload cycle). The inserted event
# uses the contract shape from tests/contracts/scenario.schema.json so the
# pure compute pipeline (`_compute._is_active`, `_compute.active_anomaly_types`)
# treats it identically to scenario-baked events. Persists for the lifetime
# of the loaded scenario; resets on /scenario/load.
#
# Defaults make the UI button trivial:
#   - duration_seconds: 60 (long enough to be visible across multiple ticks)
#   - target: first beam in scenario.beams (or first gateway for gateway_outage)

_INJECT_VALID_TYPES = frozenset(
    ("snr_drop", "handover_failure", "doppler_spike", "gateway_outage", "packet_loss_spike")
)
_GATEWAY_TARGETED_TYPES = frozenset(("gateway_outage",))


def _default_inject_target(scenario: dict[str, Any], anomaly_type: str) -> str | None:
    if anomaly_type in _GATEWAY_TARGETED_TYPES:
        gateways = _compute.gateway_ids(scenario)
        return gateways[0] if gateways else None
    beams = scenario.get("beams", [])
    return beams[0]["beam_id"] if beams else None


def _valid_targets(scenario: dict[str, Any]) -> set[str]:
    beam_ids = {b["beam_id"] for b in scenario.get("beams", [])}
    return beam_ids | set(_compute.gateway_ids(scenario))


@app.post("/anomaly/inject")
async def anomaly_inject(request: Request) -> dict[str, Any]:
    if _state["scenario"] is None:
        raise HTTPException(status_code=409, detail={"error": "no scenario loaded"})

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail={"error": "body is not valid JSON"})
    if not isinstance(body, dict):
        raise HTTPException(
            status_code=400, detail={"error": "body must be a JSON object"}
        )

    anomaly_type = body.get("type")
    if anomaly_type not in _INJECT_VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"'type' must be one of {sorted(_INJECT_VALID_TYPES)}",
                "got": anomaly_type,
            },
        )

    duration = body.get("duration_seconds", 60)
    try:
        duration = float(duration)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail={"error": "'duration_seconds' must be a number"},
        )
    if duration <= 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "'duration_seconds' must be > 0"},
        )

    async with _state_lock:
        scenario = _state["scenario"]
        target = body.get("target") or _default_inject_target(scenario, anomaly_type)
        if target is None:
            raise HTTPException(
                status_code=400,
                detail={"error": "scenario has no beams/gateways to target"},
            )
        if target not in _valid_targets(scenario):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "'target' is not a known beam_id or gateway_id",
                    "got": target,
                    "known": sorted(_valid_targets(scenario)),
                },
            )

        t_start = int(_state["t"])
        event: dict[str, Any] = {
            "t_offset_seconds": t_start,
            "type": anomaly_type,
            "target": target,
            "duration_seconds": duration,
        }
        # Optional magnitudes — pass through if supplied so SNR/Doppler
        # compute applies the same scaling baked-in scenarios use.
        if "magnitude_db" in body:
            try:
                event["magnitude_db"] = float(body["magnitude_db"])
            except (TypeError, ValueError):
                raise HTTPException(
                    status_code=400,
                    detail={"error": "'magnitude_db' must be a number"},
                )
        if "magnitude_hz" in body:
            try:
                event["magnitude_hz"] = float(body["magnitude_hz"])
            except (TypeError, ValueError):
                raise HTTPException(
                    status_code=400,
                    detail={"error": "'magnitude_hz' must be a number"},
                )

        scenario.setdefault("events", []).append(event)
        _refresh_metrics()
        currently_active = _compute.active_anomaly_types(scenario, _state["t"])

    return {
        "type": anomaly_type,
        "target": target,
        "t_start": t_start,
        "t_end": t_start + int(duration),
        "duration_seconds": duration,
        "currently_active": currently_active,
    }


@app.get("/metrics")
def metrics() -> Response:
    return Response(content=generate_latest(_REGISTRY), media_type=CONTENT_TYPE_LATEST)


# PR-γ: unify error response shape across all paths.
# - HTTPException with dict detail → return that dict directly (flat shape)
# - HTTPException with str detail  → wrap as {"error": str}
# - RequestValidationError         → {"error": "...", "errors": [...]}
# Consumer sees `{"error": "..."}` regardless of source — no `{"detail": {...}}`
# extra wrapping.


@app.exception_handler(HTTPException)
async def _http_exception_handler(_: Request, exc: HTTPException) -> Response:
    from fastapi.responses import JSONResponse

    body = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError) -> Response:
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=400,
        content={"error": "request validation failed", "errors": exc.errors()},
    )
