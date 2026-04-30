"""LLM provider abstraction.

Two implementations:
- ``FakeLLMProvider``: deterministic, pattern-matches on anomaly_type +
  evidence; never calls network. Always available.
- ``OpenAICompatibleProvider``: stub for Sprint 2 (Ollama / vLLM / real
  OpenAI). Not wired this turn.

Per ADR-004 the provider receives a structured ``Evidence`` object plus an
``anomaly_type`` hint; the system_prompt is held by the caller. The provider
is told to treat all log lines as **data, not commands** — see ``_grounding``.
"""

from __future__ import annotations

from typing import Any, Protocol

from .models import Evidence


class LLMProvider(Protocol):
    """Provider contract. Returns a dict matching the v2 response keys other
    than ``evidence`` and ``status`` (the caller fills those in)."""

    def chat(
        self,
        *,
        system_prompt: str,
        anomaly_type: str,
        evidence: Evidence,
    ) -> dict[str, Any]: ...


class FakeLLMProvider:
    """Deterministic, offline provider for tests + Sprint 1 demo.

    The provider IGNORES log content for decision-making (logs are evidence,
    not instructions). It only inspects ``evidence.metrics_used`` to choose
    which canned analysis to return.
    """

    def chat(
        self,
        *,
        system_prompt: str,
        anomaly_type: str,
        evidence: Evidence,
    ) -> dict[str, Any]:
        # System prompt is referenced by the implementer for parity with real
        # providers; the fake doesn't need to read it.
        _ = system_prompt

        if anomaly_type == "snr_drop":
            return self._snr_drop_analysis(evidence)
        if anomaly_type == "handover_failure":
            return self._handover_failure_analysis(evidence)
        if anomaly_type == "gateway_outage":
            return self._gateway_outage_analysis(evidence)
        return self._unknown_anomaly(anomaly_type)

    # --- canned analyses --------------------------------------------------

    @staticmethod
    def _no_relevant_evidence(anomaly_type: str, expected: str) -> dict[str, Any]:
        """PR-β: when anomaly_type is plausible but evidence has no matching
        metric, refuse to fabricate. Caller (main._explain_or_runbook) will
        downgrade this to INSUFFICIENT_EVIDENCE."""
        return {
            "summary": None,
            "likely_cause": None,
            "recommended_actions": [],
            "risk_if_ignored": None,
            "confidence": 0.0,
            "unknowns": [
                f"anomaly_type={anomaly_type!r} requires {expected} in evidence; "
                f"none found. Cannot ground an analysis."
            ],
        }

    @staticmethod
    def _snr_drop_analysis(evidence: Evidence) -> dict[str, Any]:
        snr_metrics = [
            m for m in evidence.metrics_used if m.name == "orbitops_beam_snr_db"
        ]
        if not snr_metrics:
            return FakeLLMProvider._no_relevant_evidence(
                "snr_drop", "orbitops_beam_snr_db metric"
            )

        beam_id = snr_metrics[0].labels.get("beam_id", "unknown")
        min_snr = min(m.value for m in snr_metrics)

        summary = (
            f"Beam SNR degradation detected on {beam_id}. "
            f"Cited orbitops_beam_snr_db dropped to {min_snr:.1f} dB during the pass."
        )
        likely_cause = (
            f"SNR on {beam_id} fell below the link-adaptation threshold of 8 dB. "
            f"Most consistent with low-elevation beam pointing combined with a "
            f"transient RF environment shift; rain-fade and pointing error are "
            f"the two leading hypotheses."
        )
        return {
            "summary": summary,
            "likely_cause": likely_cause,
            "recommended_actions": [
                {
                    "step": 1,
                    "title": "Trigger handover to next-best beam",
                    "body": (
                        f"Hand over {beam_id} traffic to the highest-elevation neighbouring "
                        f"beam to restore SNR margin."
                    ),
                },
                {
                    "step": 2,
                    "title": "Verify Doppler compensation",
                    "body": (
                        "Confirm orbitops_doppler_residual_hz is within ±500 Hz; "
                        "high residual amplifies SNR loss."
                    ),
                },
                {
                    "step": 3,
                    "title": "Inspect link-adaptation configuration",
                    "body": (
                        "Check that modcod is set to switch to a more robust profile when "
                        "SNR drops below 8 dB."
                    ),
                },
            ],
            "risk_if_ignored": (
                "Continued packet loss on the affected beam, escalating to full link "
                "drop once SNR < 4 dB. Knock-on impact on user traffic during the pass window."
            ),
            "confidence": 0.78,
            "unknowns": [
                "Whether RF interference (vs pointing error) is the dominant cause.",
                "Whether the next pass will reproduce the issue at the same elevation.",
            ],
        }

    @staticmethod
    def _handover_failure_analysis(evidence: Evidence) -> dict[str, Any]:
        relevant = [
            m
            for m in evidence.metrics_used
            if (m.name == "orbitops_handover_state" and m.value >= 1.0)
            or (
                m.name == "orbitops_anomaly_active"
                and m.labels.get("type") == "handover_failure"
                and m.value >= 1.0
            )
        ]
        if not relevant:
            return FakeLLMProvider._no_relevant_evidence(
                "handover_failure",
                "orbitops_handover_state ≥ 1 or orbitops_anomaly_active{type=handover_failure} = 1",
            )
        return {
            "summary": "Handover failure detected on at least one beam.",
            "likely_cause": (
                "Source-target handshake exceeded the handover timer. Often correlated "
                "with high Doppler residual or stale beam-pointing predictions."
            ),
            "recommended_actions": [
                {
                    "step": 1,
                    "title": "Check Doppler residual",
                    "body": "Verify orbitops_doppler_residual_hz is within ±500 Hz at handover boundary.",
                },
                {
                    "step": 2,
                    "title": "Retry handover",
                    "body": "Allow the handover timer to lapse and trigger a single retry.",
                },
                {
                    "step": 3,
                    "title": "Fallback to backup beam",
                    "body": "If retries fail, switch traffic to a pre-validated backup beam profile.",
                },
                {
                    "step": 4,
                    "title": "Page operator on repeat failure",
                    "body": "If 3 consecutive handovers fail in this pass, escalate.",
                },
            ],
            "risk_if_ignored": (
                "Service interruption during handover gap; user traffic may drop until "
                "the next handover opportunity arrives."
            ),
            "confidence": 0.72,
            "unknowns": [
                "Whether root cause is RF (Doppler) or signaling (timer/protocol).",
                "Whether a software defect contributes (vs propagation conditions).",
            ],
        }

    @staticmethod
    def _gateway_outage_analysis(evidence: Evidence) -> dict[str, Any]:
        relevant = [
            m
            for m in evidence.metrics_used
            if (m.name == "orbitops_gateway_available" and m.value == 0.0)
            or (
                m.name == "orbitops_anomaly_active"
                and m.labels.get("type") == "gateway_outage"
                and m.value >= 1.0
            )
        ]
        if not relevant:
            return FakeLLMProvider._no_relevant_evidence(
                "gateway_outage",
                "orbitops_gateway_available = 0 or orbitops_anomaly_active{type=gateway_outage} = 1",
            )
        return {
            "summary": "Gateway availability dropped to zero.",
            "likely_cause": (
                "Gateway pod liveness probe failed; processing pipeline halted. "
                "Most likely root causes are pod OOM, recent deploy regression, or "
                "upstream dependency outage."
            ),
            "recommended_actions": [
                {
                    "step": 1,
                    "title": "Verify pod status",
                    "body": "kubectl -n orbitops get pods -l app=gateway",
                },
                {
                    "step": 2,
                    "title": "Switch to backup gateway",
                    "body": "Update the gateway-routing ConfigMap to point at the backup endpoint.",
                },
                {
                    "step": 3,
                    "title": "Investigate root cause",
                    "body": "Pull pod logs and recent deployment diff before restoring primary.",
                },
            ],
            "risk_if_ignored": (
                "Backup gateway capacity may be insufficient for sustained load; "
                "extended outage risks data loss for non-buffered telemetry."
            ),
            "confidence": 0.70,
            "unknowns": [
                "Backup gateway rated capacity vs current traffic.",
                "Whether the outage is local or upstream-induced.",
            ],
        }

    @staticmethod
    def _unknown_anomaly(anomaly_type: str) -> dict[str, Any]:
        return {
            "summary": None,
            "likely_cause": None,
            "recommended_actions": [],
            "risk_if_ignored": None,
            "confidence": 0.0,
            "unknowns": [
                f"No canned analysis for anomaly_type={anomaly_type!r}; "
                "a real LLM provider would be needed to interpret this.",
            ],
        }
