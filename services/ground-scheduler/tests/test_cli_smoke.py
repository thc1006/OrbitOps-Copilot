"""Smoke test for the demo CLI's `run_demo()` entry point.

Exercises the full real pipeline (bundled TLE -> skyfield contact
geometry -> greedy schedule) end to end, the same code path
`python -m ground_scheduler.cli` runs, without capturing stdout.
"""

from __future__ import annotations

from ground_scheduler.cli import run_demo


def test_run_demo_produces_nonempty_schedule_result() -> None:
    result = run_demo()

    assert result.metrics["n_windows"] > 0
    assert (
        result.metrics["n_scheduled"] + result.metrics["n_rejected"] == result.metrics["n_windows"]
    )
