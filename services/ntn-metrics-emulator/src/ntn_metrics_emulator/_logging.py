"""Structured JSON logging for ntn-metrics-emulator.

Closes I-9 (the emulator half). Replaces zero-logging-by-default with
JSON-formatted stdout suitable for Loki ingestion (VS-10b). The
formatter is intentionally tiny — no `python-json-logger` dependency —
so the bundle stays trim.

Field contract (locked-in by tests/test_logging.py):

    ts      ISO-8601 UTC timestamp (from record.created)
    level   record.levelname
    logger  record.name
    msg     record.getMessage()  (short event tag)
    +       any `extra={...}` keys passed to logger.info / .warning / etc.

Usage:

    from ._logging import logger
    logger.info("scenario.load", extra={"scenario_id": "x", "beams": 3})

Calls without `extra=` still emit valid JSON (just without the per-event
fields), so the contract degrades gracefully.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

# logging.LogRecord attributes that aren't user payload — exclude from
# the JSON output so `extra={...}` fields survive but stdlib internals
# don't pollute the log line.
_RESERVED = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
        "taskName",  # py3.12+
    }
)


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per log record on a single line."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        out: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for k, v in record.__dict__.items():
            if k not in _RESERVED and not k.startswith("_"):
                out[k] = v
        if record.exc_info:
            out["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(out, default=str, ensure_ascii=False)


_CONFIGURED = False


def setup_logging(level: int = logging.INFO) -> None:
    """Idempotent root-logger setup. Called once at app boot.

    Replaces any existing handlers on the root logger with a single
    StreamHandler-on-stdout using JsonFormatter. Subsequent calls are
    no-ops so test fixtures that re-import the module don't stack
    handlers (would duplicate every log line).
    """
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    _CONFIGURED = True


# Module-level logger that main.py uses for emulator events.
logger = logging.getLogger("ntn_metrics_emulator.main")
