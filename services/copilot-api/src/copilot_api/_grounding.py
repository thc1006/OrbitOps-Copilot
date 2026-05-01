"""Grounding policy: which questions are in-domain, which jailbreak markers
to flag, and how user-supplied text is normalised before reaching the LLM.

Per ADR-004 + SPEC-003: user input MUST go through a placeholder-templated
prompt; this module is the centralised guard against direct concatenation.
"""

from __future__ import annotations

# Domain vocabulary: a question is "supported" iff it contains at least one
# of these tokens (case-insensitive). Conservative on purpose — we'd rather
# REFUSE a borderline question and let the user reword than hallucinate.
_DOMAIN_TERMS: tuple[str, ...] = (
    "beam",
    "snr",
    "sinr",
    "doppler",
    "handover",
    "gateway",
    "scenario",
    "anomaly",
    "runbook",
    "latency",
    "packet",
    "loss",
    "throughput",
    "modcod",
    "link",
    "pass",
    "elevation",
    "satellite",
    "ntn",
    "leo",
    "ground station",
    "ground-station",
    "ka-band",
    "rf",
)


# Substrings that, if present in user text or log lines, indicate prompt-
# injection attempts. We do NOT remove them (logs are evidence) — we just
# instruct the LLM via system prompt to treat them as untrusted data, and
# we tag the prompt envelope so the FakeLLMProvider can be deterministic
# about ignoring them.
JAILBREAK_MARKERS: tuple[str, ...] = (
    "ignore previous",
    "ignore all previous",
    "disregard previous",
    "system prompt",
    "you are now",
    "from now on respond",
    "pwned",
    "jailbreak",
)


def is_supported_question(question: str) -> bool:
    """True if the question references at least one OrbitOps domain term."""
    q = question.lower()
    return any(term in q for term in _DOMAIN_TERMS)


def sanitize_text(text: str) -> str:
    """Strip ASCII control characters except newline/tab; preserve content
    semantics so jailbreak attempts remain visible (and visibly ignored)."""
    cleaned = "".join(c for c in text if c in "\n\t" or c.isprintable())
    return cleaned.strip()


def has_injection_marker(text: str) -> bool:
    low = text.lower()
    return any(m in low for m in JAILBREAK_MARKERS)
