"""VS-21 (Sprint-5) — safe-action registry for the closed-loop *dry_run* MVP.

SPEC-S006-VS21 §5.1 defines exactly three "safe" cluster actions. This module
holds their metadata + the strategic-merge patch each would produce, and a
human-readable diff renderer. It is used ONLY by the side-effect-free
`POST /action/dry-run` endpoint.

Deliberately NOT here (deferred per owner directive — the apply/security
surface): git commit, GitHub App token, real kubectl/apply, Kargo, in-cluster
RBAC, rate-limit, audit-log. Building a patch dict is pure and mutates nothing.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


class UnknownActionError(Exception):
    """Raised when an action_id is not in the SPEC §5.1 whitelist (→ 422)."""


class ActionParamError(Exception):
    """Raised when an action's params fail validation (→ 422)."""


# 3GPP Rel-19 payload types for set_payload_mode.
_PAYLOAD_MODES = ("regenerative", "transparent")


def _build_scale(params: dict[str, Any]) -> dict[str, Any]:
    n = params.get("replicas")
    # bool is an int subclass — reject it explicitly so True/False can't scale.
    if isinstance(n, bool) or not isinstance(n, int) or not (1 <= n <= 3):
        raise ActionParamError(
            f"replicas must be an integer in 1..3 (kubeadm single-node budget), "
            f"got {n!r}"
        )
    return {"spec": {"replicas": n}}


def _build_restart(params: dict[str, Any]) -> dict[str, Any]:
    # Rolling restart = a change to the pod-template annotation. The value is
    # illustrative in dry-run (a real apply stamps the actual timestamp).
    return {
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": (
                            "<set to RFC-3339 timestamp at real apply>"
                        )
                    }
                }
            }
        }
    }


def _build_payload_mode(params: dict[str, Any]) -> dict[str, Any]:
    mode = params.get("mode")
    if mode not in _PAYLOAD_MODES:
        raise ActionParamError(
            f"mode must be one of {list(_PAYLOAD_MODES)} (3GPP Rel-19), got {mode!r}"
        )
    # Strategic-merge patch keyed by container name + env name (merge keys).
    return {
        "spec": {
            "template": {
                "spec": {
                    "containers": [
                        {
                            "name": "emulator",
                            "env": [{"name": "PAYLOAD_MODE", "value": mode}],
                        }
                    ]
                }
            }
        }
    }


@dataclass(frozen=True)
class SafeAction:
    action_id: str
    description: str
    target_kind: str
    target_name: str
    inverse_action_id: str | None
    build_patch: Callable[[dict[str, Any]], dict[str, Any]]
    # UI form descriptor — single source of truth so the UI never hardcodes
    # the action set / param ranges (Chain #1 anti-drift). Each entry:
    #   {"name", "kind": "int"|"enum", ...bounds}
    params_spec: tuple[dict[str, Any], ...]

    @property
    def target_resource(self) -> str:
        return f"{self.target_kind}/{self.target_name}"

    def render_diff(self, params: dict[str, Any]) -> str:
        """Flatten the strategic-merge patch into `path: value` lines. Building
        the patch also validates params (may raise ActionParamError)."""
        return _flatten_diff(self.target_resource, self.build_patch(params))


def _flatten_diff(resource: str, patch: dict[str, Any]) -> str:
    lines = [resource]

    def walk(node: Any, path: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}" if path else k)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")
        else:
            lines.append(f"  {path}: {node}")

    walk(patch, "")
    return "\n".join(lines)


# SPEC-S006-VS21 §5.1 — exactly these three, shipped together (Chain #6).
_REGISTRY: dict[str, SafeAction] = {
    "scale_copilot_api_replicas": SafeAction(
        action_id="scale_copilot_api_replicas",
        description="Set spec.replicas of Deployment/copilot-api to N (1..3).",
        target_kind="Deployment",
        target_name="copilot-api",
        inverse_action_id="scale_copilot_api_replicas",
        build_patch=_build_scale,
        params_spec=(
            {"name": "replicas", "kind": "int", "min": 1, "max": 3, "default": 2},
        ),
    ),
    "restart_emulator_pod": SafeAction(
        action_id="restart_emulator_pod",
        description="Rolling-restart Deployment/ntn-metrics-emulator.",
        target_kind="Deployment",
        target_name="ntn-metrics-emulator",
        inverse_action_id=None,  # rolling restart is forward-only
        build_patch=_build_restart,
        params_spec=(),
    ),
    "set_payload_mode": SafeAction(
        action_id="set_payload_mode",
        description="Set the emulator PAYLOAD_MODE env (regenerative|transparent).",
        target_kind="Deployment",
        target_name="ntn-metrics-emulator",
        inverse_action_id="set_payload_mode",
        build_patch=_build_payload_mode,
        params_spec=(
            {
                "name": "mode",
                "kind": "enum",
                "options": list(_PAYLOAD_MODES),
                "default": "transparent",
            },
        ),
    ),
}

SAFE_ACTION_IDS: tuple[str, ...] = tuple(_REGISTRY)


def get_action(action_id: str) -> SafeAction:
    try:
        return _REGISTRY[action_id]
    except KeyError:
        raise UnknownActionError(
            f"action_id {action_id!r} not in whitelist {list(SAFE_ACTION_IDS)}"
        )


# VS-23 — which safe action fits which detected anomaly. Keys are the anomaly_type
# vocabulary from _retrieval.classify / _provider. doppler_compensation_warning
# has NO entry: no cluster action mitigates a Doppler-residual issue, so no action
# is recommended (honest — never suggest an action that wouldn't help).
_ANOMALY_ACTION_MAP: dict[str, tuple[str, dict[str, Any], str]] = {
    "snr_drop": (
        "set_payload_mode",
        {"mode": "regenerative"},
        "Switch the payload to regenerative so the signal is re-generated on-board, "
        "improving effective SNR on the degraded downlink.",
    ),
    "handover_failure": (
        "restart_emulator_pod",
        {},
        "Rolling-restart clears stuck handover state; forward-only recovery with no "
        "data loss (emulator state is reconstructable via /scenario/load).",
    ),
    "gateway_outage": (
        "scale_copilot_api_replicas",
        {"replicas": 2},
        "Add a copilot-api replica to absorb the request surge caused by the gateway "
        "fallback.",
    ),
}


def recommend_action(anomaly_type: str) -> dict[str, Any] | None:
    """Return a grounded ActionPlan-shaped dict for *anomaly_type*, or None when
    no safe action fits. The action_id is always in the SPEC §5.1 whitelist."""
    entry = _ANOMALY_ACTION_MAP.get(anomaly_type)
    if entry is None:
        return None
    action_id, params, rationale = entry
    action = _REGISTRY[action_id]
    return {
        "action_id": action_id,
        "params": params,
        "rationale": rationale,
        "inverse_action_id": action.inverse_action_id,
    }


def catalog() -> list[dict[str, Any]]:
    """Serializable metadata for all safe actions — drives the UI form so the
    UI never hardcodes the action set or param bounds."""
    return [
        {
            "action_id": a.action_id,
            "description": a.description,
            "target_resource": a.target_resource,
            "inverse_action_id": a.inverse_action_id,
            "params_spec": [dict(p) for p in a.params_spec],
        }
        for a in _REGISTRY.values()
    ]
