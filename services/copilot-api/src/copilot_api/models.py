"""Pydantic models (v2) for the copilot-api response and request shapes.

Source of truth: tests/contracts/copilot-response.schema.json (v2 / ADR-007).
SPEC: docs/specs/SPEC-003-copilot-api.md.

PR-α: every model has ``extra="forbid"`` to align with the JSON schema's
``additionalProperties: false`` — refuses unknown request fields with 422
instead of silently dropping them.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

_STRICT = ConfigDict(extra="forbid")


# ---------- evidence citation primitives -----------------------------------


class MetricCitation(BaseModel):
    model_config = _STRICT
    name: str
    labels: dict[str, str]
    value: float
    timestamp: datetime


class LogCitation(BaseModel):
    model_config = _STRICT
    source: str
    line: str
    timestamp: datetime


class Evidence(BaseModel):
    model_config = _STRICT
    metrics_used: list[MetricCitation] = Field(default_factory=list)
    logs_used: list[LogCitation] = Field(default_factory=list)
    scenario_id: str | None = None
    time_window_seconds: int | None = Field(default=None, ge=0)
    timestamp: datetime


# ---------- recommended action ---------------------------------------------


class RecommendedAction(BaseModel):
    model_config = _STRICT
    step: int = Field(ge=1)
    title: str = Field(min_length=1)
    body: str = Field(min_length=1)


# ---------- top-level response ---------------------------------------------


CopilotStatus = Literal["ok", "INSUFFICIENT_EVIDENCE", "REFUSED", "ERROR"]


class CopilotResponse(BaseModel):
    model_config = _STRICT
    summary: str | None = None
    likely_cause: str | None = None
    evidence: Evidence
    recommended_actions: list[RecommendedAction] = Field(default_factory=list)
    risk_if_ignored: str | None = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    unknowns: list[str] = Field(default_factory=list)
    status: CopilotStatus
    refusal_reason: str | None = None
    error: str | None = None


# ---------- request bodies --------------------------------------------------


class AskRequest(BaseModel):
    model_config = _STRICT
    question: str = Field(min_length=1)
    scenario_id: str | None = None
    time_window_seconds: int | None = Field(default=None, ge=0)


class ExplainRequest(BaseModel):
    model_config = _STRICT
    anomaly_type: str = Field(min_length=1)
    metrics_snapshot: list[MetricCitation] = Field(default_factory=list)
    logs: list[LogCitation] = Field(default_factory=list)


# ---------- VS-21 closed-loop dry-run (Sprint-5) ---------------------------


class ActionDryRunRequest(BaseModel):
    model_config = _STRICT
    action_id: str = Field(min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)


class ActionDryRunResponse(BaseModel):
    model_config = _STRICT
    action_id: str
    params: dict[str, Any]
    target_resource: str
    patch: dict[str, Any]
    diff: str
    inverse_action_id: str | None
    # Always True this sprint — the endpoint has no apply path (apply/git/RBAC
    # deferred). Kept explicit so a future apply endpoint can flip it.
    dry_run: bool = True
    note: str


class ActionCatalogItem(BaseModel):
    model_config = _STRICT
    action_id: str
    description: str
    target_resource: str
    inverse_action_id: str | None
    params_spec: list[dict[str, Any]]


class ActionCatalog(BaseModel):
    model_config = _STRICT
    actions: list[ActionCatalogItem]
