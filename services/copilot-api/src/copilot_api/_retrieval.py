"""Metrics retrieval for /ask grounding.

A small adapter layer that lets ``/ask`` pull a Prometheus exposition body
from somewhere — production HTTP against the emulator, or a test-injected
in-process scraper. Keeping this behind a Protocol means:

- /ask logic stays pure (build evidence → call provider → degrade if empty)
- production deployment configures via ``ORBITOPS_EMULATOR_METRICS_URL``
- integration tests inject ``TestClient.get('/metrics')`` adapter (no real
  network, no docker-compose required for CI)

The classifier converts a Prometheus exposition into ``MetricCitation`` list
plus an inferred ``anomaly_type``. Heuristic priority (most-impactful first):

1. ``orbitops_beam_snr_db < 8`` → ``snr_drop``       (matches AC-001 threshold)
2. ``orbitops_handover_state >= 2``                  → ``handover_failure``
3. ``orbitops_gateway_available == 0``               → ``gateway_outage``

If none triggers, returns ``([], None)`` and /ask degrades to
``INSUFFICIENT_EVIDENCE``. We **never** invent an anomaly type.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Protocol

from prometheus_client.parser import text_string_to_metric_families

from .models import MetricCitation

SNR_DROP_THRESHOLD_DB = 8.0  # AC-001 threshold; below this is "degraded"
HANDOVER_FAILURE_STATE = 2.0  # per docs/contracts/metrics.md §3
# G8 — doppler_compensation_warning trips at residual > 2 kHz. Rationale
# (research 2026-05): NR demod budget caps residual CFO at ~10% of SCS;
# for SCS=30 kHz that's ~3 kHz, so 2 kHz is the conservative warning gate.
# The post-pre-comp residual on a healthy Ka-band LEO link sits well below
# this; a sustained excursion indicates ephemeris drift or loop-loss.
DOPPLER_RESIDUAL_WARNING_HZ = 2000.0
DEFAULT_TIMEOUT_SECONDS = 2.0
ENV_METRICS_URL = "ORBITOPS_EMULATOR_METRICS_URL"


class MetricsScraper(Protocol):
    """Returns the raw Prometheus exposition body for the current emulator state."""

    def scrape(self) -> str: ...


class HttpMetricsScraper:
    """Production scraper: HTTP GET against an emulator URL.

    Content-Type guard (PR-H-1): refuses anything other than `text/plain`
    so a misconfigured URL pointing at an HTML 200-OK page (a Nginx default,
    a load-balancer auth wall, a wrong path) raises a clear error rather
    than silently parsing zero metrics — the latter would surface to the
    user as 'no degraded metrics' and obscure the real misconfiguration.
    """

    PROMETHEUS_CONTENT_TYPE_PREFIX = "text/plain"

    def __init__(self, url: str, *, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        self.url = url
        self.timeout_seconds = timeout_seconds

    def scrape(self) -> str:
        import httpx

        with httpx.Client(timeout=self.timeout_seconds) as client:
            r = client.get(self.url)
            r.raise_for_status()
            # RFC 7231 §3.1.1.1: media-type is case-insensitive. Normalize
            # before prefix-check so 'Text/Plain; charset=utf-8' is accepted.
            content_type = r.headers.get("content-type", "").lower().strip()
            if not content_type.startswith(self.PROMETHEUS_CONTENT_TYPE_PREFIX):
                raise ValueError(
                    f"Expected Prometheus exposition (Content-Type: text/plain*) "
                    f"from {self.url!r}; got Content-Type: {content_type!r}. "
                    f"Verify ORBITOPS_EMULATOR_METRICS_URL points at /metrics, "
                    f"not at the service root."
                )
            return r.text


class NullScraper:
    """Default scraper when no URL is configured. Always raises with a clear
    instruction so /ask degrades to INSUFFICIENT_EVIDENCE rather than crashing."""

    def scrape(self) -> str:
        raise RuntimeError(
            "No metrics scraper is configured. Set "
            f"{ENV_METRICS_URL}=http://emulator:8000/metrics or POST evidence "
            "directly to /explain or /runbook instead."
        )


def make_default_scraper() -> MetricsScraper:
    """Read env at import time. Returns Http scraper if configured, else Null."""
    url = os.environ.get(ENV_METRICS_URL, "").strip()
    if url:
        return HttpMetricsScraper(url)
    return NullScraper()


def classify(
    prom_body: str,
    *,
    now: datetime | None = None,
) -> tuple[list[MetricCitation], str | None]:
    """Parse Prometheus exposition; return ``(citations, anomaly_type)``.

    Picks the **first** matching anomaly category by priority, returning the
    metrics that evidence it. Other categories are ignored even if also
    present — keeping the response focused on one diagnosis at a time.
    """
    timestamp = now or datetime.now(timezone.utc)

    snr_low: list[MetricCitation] = []
    ho_failed: list[MetricCitation] = []
    gw_down: list[MetricCitation] = []
    doppler_warn: list[MetricCitation] = []

    for family in text_string_to_metric_families(prom_body):
        for sample in family.samples:
            labels = dict(sample.labels)
            if (
                sample.name == "orbitops_beam_snr_db"
                and sample.value < SNR_DROP_THRESHOLD_DB
            ):
                snr_low.append(
                    MetricCitation(
                        name=sample.name,
                        labels=labels,
                        value=float(sample.value),
                        timestamp=timestamp,
                    )
                )
            elif (
                sample.name == "orbitops_handover_state"
                and sample.value >= HANDOVER_FAILURE_STATE
            ):
                ho_failed.append(
                    MetricCitation(
                        name=sample.name,
                        labels=labels,
                        value=float(sample.value),
                        timestamp=timestamp,
                    )
                )
            elif sample.name == "orbitops_gateway_available" and sample.value < 0.5:
                gw_down.append(
                    MetricCitation(
                        name=sample.name,
                        labels=labels,
                        value=float(sample.value),
                        timestamp=timestamp,
                    )
                )
            elif (
                sample.name == "orbitops_doppler_residual_hz"
                and abs(sample.value) > DOPPLER_RESIDUAL_WARNING_HZ
            ):
                doppler_warn.append(
                    MetricCitation(
                        name=sample.name,
                        labels=labels,
                        value=float(sample.value),
                        timestamp=timestamp,
                    )
                )

    # Priority: snr_drop > handover_failure > gateway_outage > doppler_compensation_warning.
    # The four anomaly classes are mutually exclusive in the response — picking
    # the most-impactful keeps the diagnosis focused.
    if snr_low:
        return (snr_low, "snr_drop")
    if ho_failed:
        return (ho_failed, "handover_failure")
    if gw_down:
        return (gw_down, "gateway_outage")
    if doppler_warn:
        return (doppler_warn, "doppler_compensation_warning")
    return ([], None)
