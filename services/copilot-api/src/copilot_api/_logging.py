"""Structured JSON logging for copilot-api.

Closes I-9 (the copilot half). /ask outcomes (REFUSED / INSUFFICIENT /
ok / ERROR) now emit one INFO line per call with status + question
character count + evidence counts. The question TEXT itself is NEVER
logged — that's a deliberate privacy + prompt-injection contract: the
field `question_chars` carries length only.

Field contract (locked-in by tests/test_logging.py):

    ts      ISO-8601 UTC timestamp (from record.created)
    level   record.levelname
    logger  record.name
    msg     record.getMessage()  (short event tag)
    +       any `extra={...}` keys passed to logger.info

Mirrors the emulator's _logging module but kept independent so each
service can evolve its log shape on its own cadence (e.g. copilot may
later log streaming-token counts, emulator probably won't).
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

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
        "taskName",
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

# Loggers uvicorn registers its own plain-text handlers on. Without
# explicit handling these bypass our root JsonFormatter and produce
# `INFO: 10.244.x.x - "GET /healthz HTTP/1.1" 200` lines that pollute
# Loki. We clear their handlers + enable propagation so root's JSON
# handler is the single emission point. (VS-10c, 2026-05-04)
_UVICORN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access")


def setup_logging(level: int = logging.INFO) -> None:
    """Idempotent root-logger setup. Called once at app boot.

    Configures BOTH the root logger AND uvicorn-namespace loggers so
    every line on stdout is JSON-formatted. Without the uvicorn pass,
    uvicorn's startup hook installs plain-text handlers that propagate
    nowhere; live-cluster Loki sees a mix of formats. VS-10c (2026-05-04).
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

    # Tame uvicorn loggers: drop their plain-text handlers, enable
    # propagation up to root (which now has JsonFormatter).
    for name in _UVICORN_LOGGERS:
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    _CONFIGURED = True


def _reset_for_tests() -> None:
    """Test-only: undo setup_logging() so a fresh setup can be tested."""
    global _CONFIGURED
    _CONFIGURED = False
    logging.getLogger().handlers.clear()
    for name in _UVICORN_LOGGERS:
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True


# Module-level logger for copilot events.
logger = logging.getLogger("copilot_api.main")
