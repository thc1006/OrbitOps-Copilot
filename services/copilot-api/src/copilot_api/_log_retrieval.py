"""Log retrieval for /ask grounding (VS-10b.1 — class only; wiring lands in VS-10b.2).

Mirrors the metrics-retrieval pattern in `_retrieval.py`:

  Protocol     : LogScraper.fetch_recent(*, since_seconds) -> list[LogCitation]
  Default null : NullLogScraper (returns []) — used when ORBITOPS_LOKI_URL
                 is unset so the existing /ask path degrades cleanly.
  Real impl    : LokiLogScraper — HTTP GET against Loki's
                 `/loki/api/v1/query_range` endpoint.
  Factory      : make_default_log_scraper() — env-var-driven selection.

LogQL query is scoped to `{service=~"orbitops-.*"}` so promtail-shipped
logs from emulator + copilot get picked up but the `httpx`/uvicorn noise
that promtail might also forward (depending on label config) is filtered
out. Promtail is configured (in observability/promtail/promtail-config
.yaml) to label container logs with `service` from the container name.

Time range: end = now, start = end - since_seconds, both as nanosecond
epoch (Loki's wire format). Configurable via the `since_seconds`
parameter so callers can match the time_window_seconds the user passed
on /ask.

Errors: httpx.HTTPStatusError bubbles up. The caller (ask handler) is
expected to wrap and degrade to evidence-empty + a "logs unavailable"
note rather than 5xx-ing — same contract as the existing MetricsScraper
failure handling in /ask.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Protocol

import httpx

from .models import LogCitation


class LogScraper(Protocol):
    """Adapter contract — see module docstring."""

    def fetch_recent(self, *, since_seconds: int) -> list[LogCitation]: ...


class NullLogScraper:
    """No-op implementation. Used when ORBITOPS_LOKI_URL is unset; the
    /ask handler treats the empty list as "logs unavailable" and degrades
    gracefully (evidence.logs_used=[] is not a hard error)."""

    def fetch_recent(self, *, since_seconds: int) -> list[LogCitation]:  # noqa: ARG002
        return []


class LokiLogScraper:
    """HTTP client against Loki's `/loki/api/v1/query_range` endpoint.

    Constructor accepts an optional `transport` so tests can inject
    `httpx.MockTransport` (no real network).
    """

    def __init__(
        self,
        base_url: str,
        timeout_s: float = 5.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        # Build kwargs explicitly so passing transport=None doesn't override
        # httpx's default with a literal None (would disable transport).
        kwargs: dict = {"timeout": timeout_s}
        if transport is not None:
            kwargs["transport"] = transport
        self._client = httpx.Client(**kwargs)

    def fetch_recent(self, *, since_seconds: int = 300) -> list[LogCitation]:
        end = datetime.now(timezone.utc)
        end_ns = int(end.timestamp() * 1_000_000_000)
        start_ns = end_ns - since_seconds * 1_000_000_000

        # Scope to OrbitOps-emitted logs. Regex match across services
        # (promtail labels container logs with `service=<container_name>`).
        logql = '{service=~"orbitops-.*"}'
        r = self._client.get(
            f"{self.base_url}/loki/api/v1/query_range",
            params={
                "query": logql,
                "start": str(start_ns),
                "end": str(end_ns),
                "limit": "100",
                # `direction=forward` so timestamps appear chronologically;
                # default `backward` would put newest first, which fights
                # the natural "story arc" reading order in evidence panels.
                "direction": "forward",
            },
        )
        r.raise_for_status()
        return _parse_loki_response(r.json())


def _parse_loki_response(body: dict) -> list[LogCitation]:
    """Loki `query_range` shape:

      {"data": {"result": [
        {"stream": {"service": "copilot-api"},
         "values": [["<ts_ns>", "<line>"], ...]}, ...
      ]}}

    Flatten to a chronologically-sorted list[LogCitation].
    """
    out: list[LogCitation] = []
    for stream in body.get("data", {}).get("result", []):
        labels = stream.get("stream", {})
        source = labels.get("service", "?")
        for ts_ns, line in stream.get("values", []):
            ts = datetime.fromtimestamp(int(ts_ns) / 1e9, tz=timezone.utc)
            out.append(LogCitation(source=source, line=line, timestamp=ts))
    out.sort(key=lambda c: c.timestamp)
    return out


def make_default_log_scraper() -> LogScraper:
    """Env-var driven factory.

    `ORBITOPS_LOKI_URL` set → LokiLogScraper(base_url=that URL)
    unset / empty       → NullLogScraper (no logs surfaced; evidence.logs_used=[])
    """
    base = os.environ.get("ORBITOPS_LOKI_URL", "").strip()
    if not base:
        return NullLogScraper()
    return LokiLogScraper(base)
