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
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
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

_METRIC_TO_GAUGE: dict[str, Gauge] = {
    "orbitops_beam_snr_db": _BEAM_SNR,
    "orbitops_beam_sinr_db": _BEAM_SINR,
    "orbitops_link_latency_ms": _LINK_LATENCY,
    "orbitops_packet_loss_ratio": _PACKET_LOSS,
    "orbitops_doppler_residual_hz": _DOPPLER,
    "orbitops_handover_state": _HANDOVER_STATE,
    "orbitops_gateway_available": _GATEWAY_AVAIL,
    "orbitops_anomaly_active": _ANOMALY_ACTIVE,
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
    candidates = [
        Path.cwd() / "tests" / "contracts" / "scenario.schema.json",
        Path(__file__).resolve().parents[4] / "tests" / "contracts" / "scenario.schema.json",
    ]
    for p in candidates:
        if p.is_file():
            return p
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
