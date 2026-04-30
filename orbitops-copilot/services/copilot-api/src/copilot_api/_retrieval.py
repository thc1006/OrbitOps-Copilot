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
DEFAULT_TIMEOUT_SECONDS = 2.0
ENV_METRICS_URL = "ORBITOPS_EMULATOR_METRICS_URL"


class MetricsScraper(Protocol):
    """Returns the raw Prometheus exposition body for the current emulator state."""

    def scrape(self) -> str: ...


class HttpMetricsScraper:
    """Production scraper: HTTP GET against an emulator URL."""

    def __init__(self, url: str, *, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        self.url = url
        self.timeout_seconds = timeout_seconds

    def scrape(self) -> str:
        import httpx  # lazy: avoid pulling httpx into import path of NullScraper users

        with httpx.Client(timeout=self.timeout_seconds) as client:
            r = client.get(self.url)
            r.raise_for_status()
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
            elif sample.name == "orbitops_gateway_available" and sample.value == 0.0:
                gw_down.append(
                    MetricCitation(
                        name=sample.name,
                        labels=labels,
                        value=float(sample.value),
                        timestamp=timestamp,
                    )
                )

    if snr_low:
        return (snr_low, "snr_drop")
    if ho_failed:
        return (ho_failed, "handover_failure")
    if gw_down:
        return (gw_down, "gateway_outage")
    return ([], None)
