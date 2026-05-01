"""TDD red phase for G8 — doppler_compensation_warning classification.

Original Use Case 2 listed Doppler-compensation warnings alongside
handover failure and gateway fallback. Sprint-1 ships
`orbitops_doppler_residual_hz` but classify() does not surface it as a
distinct anomaly — large residual is silently ignored unless one of
the existing 3 categories also fires.

This test fails until:
  1. _retrieval.classify() emits anomaly_type == "doppler_compensation_warning"
     when residual exceeds the threshold AND none of the higher-priority
     anomalies (snr_drop, handover_failure, gateway_outage) is active.
  2. The CopilotResponse schema accepts the new anomaly_type label
     (already a free-form string, but FakeLLMProvider needs a branch).

The ordering matters: snr_drop > handover_failure > gateway_outage >
doppler_compensation_warning. A Ka-band LEO at 600 km has ~±25 kHz
peak residual when uncompensated; the gNB's compensation loop normally
keeps it inside a few-kHz envelope. Per 3GPP TS 38.821 §6 + TR 38.811 §6
NTN guidance, NR demod margin caps residual CFO at ~10% of the SCS, so
for SCS=30 kHz the operational ceiling is ~3 kHz; we trip the warning
at residual > 2_000 Hz as a conservative early-warning gate beneath
that ceiling. Source-of-truth = `_retrieval.DOPPLER_RESIDUAL_WARNING_HZ`.
"""

from __future__ import annotations

from copilot_api._retrieval import classify


PROM_NOMINAL = """\
# HELP orbitops_beam_snr_db SNR
orbitops_beam_snr_db{beam_id="beam-1"} 12.5
orbitops_beam_snr_db{beam_id="beam-2"} 13.0
orbitops_handover_state{beam_id="beam-1"} 0
orbitops_gateway_available{gateway_id="gw-tpe"} 1
"""


def test_high_doppler_residual_alone_classifies_as_compensation_warning() -> None:
    """Only doppler_residual_hz exceeds threshold; everything else nominal.
    classify() should return ('doppler_compensation_warning', ...) with
    the offending residual sample as the citation."""
    body = PROM_NOMINAL + (
        '\norbitops_doppler_residual_hz{beam_id="beam-1"} 8200\n'
    )
    citations, anomaly_type = classify(body)
    assert anomaly_type == "doppler_compensation_warning", (
        f"expected doppler_compensation_warning, got {anomaly_type!r}"
    )
    assert any(
        c.name == "orbitops_doppler_residual_hz" for c in citations
    ), "doppler residual sample should appear as citation"


def test_doppler_residual_below_threshold_does_not_classify() -> None:
    """Compensation loop is keeping residual in band — no anomaly."""
    body = PROM_NOMINAL + (
        '\norbitops_doppler_residual_hz{beam_id="beam-1"} 1500\n'
    )
    citations, anomaly_type = classify(body)
    assert anomaly_type is None, (
        f"expected no anomaly for low residual, got {anomaly_type!r}"
    )
    assert citations == []


def test_doppler_warning_yields_to_higher_priority_snr_drop() -> None:
    """If both SNR is below threshold AND residual is high, snr_drop wins
    (it's a stronger signal of degraded link). The response should NOT
    advertise doppler_compensation_warning; that diagnosis is hidden."""
    body = """\
orbitops_beam_snr_db{beam_id="beam-1"} 6.5
orbitops_doppler_residual_hz{beam_id="beam-1"} 9000
orbitops_handover_state{beam_id="beam-1"} 0
"""
    citations, anomaly_type = classify(body)
    assert anomaly_type == "snr_drop"
    # The citation list must be SNR-only — doppler is not in evidence
    # for this diagnosis.
    assert any(c.name == "orbitops_beam_snr_db" for c in citations)
    assert all(c.name != "orbitops_doppler_residual_hz" for c in citations)


def test_doppler_warning_yields_to_handover_failure() -> None:
    """Handover failure outranks doppler warning."""
    body = """\
orbitops_beam_snr_db{beam_id="beam-1"} 12.5
orbitops_handover_state{beam_id="beam-1"} 2
orbitops_doppler_residual_hz{beam_id="beam-1"} 9000
orbitops_gateway_available{gateway_id="gw-tpe"} 1
"""
    citations, anomaly_type = classify(body)
    assert anomaly_type == "handover_failure"


def test_doppler_warning_yields_to_gateway_outage() -> None:
    """Gateway outage outranks doppler warning."""
    body = """\
orbitops_beam_snr_db{beam_id="beam-1"} 12.5
orbitops_handover_state{beam_id="beam-1"} 0
orbitops_gateway_available{gateway_id="gw-tpe"} 0
orbitops_doppler_residual_hz{beam_id="beam-1"} 9000
"""
    citations, anomaly_type = classify(body)
    assert anomaly_type == "gateway_outage"
