#!/usr/bin/env python3
"""Validate sample scenarios against tests/contracts/*.schema.json.

Used by Makefile (`make schema-check`), verify.sh, and test.sh.
Exits non-zero on any failure.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import jsonschema
except ImportError:  # pragma: no cover
    print("[validate_schemas] jsonschema not installed; run 'make bootstrap'", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent

CONTRACTS = ROOT / "tests" / "contracts"
SCENARIOS = ROOT / "packages" / "scenarios"
GOLDEN = ROOT / "tests" / "golden"


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    failed = 0

    scenario_schema = load(CONTRACTS / "scenario.schema.json")
    metrics_schema = load(CONTRACTS / "metrics.schema.json")
    copilot_schema = load(CONTRACTS / "copilot-response.schema.json")

    # 1. self-validate the schemas themselves
    for name, schema in (
        ("scenario.schema.json", scenario_schema),
        ("metrics.schema.json", metrics_schema),
        ("copilot-response.schema.json", copilot_schema),
    ):
        try:
            jsonschema.Draft202012Validator.check_schema(schema)
            print(f"  ok   schema sanity: {name}")
        except Exception as exc:  # pragma: no cover
            print(f"  FAIL schema sanity: {name}: {exc}", file=sys.stderr)
            failed += 1

    # 2. validate sample scenarios against scenario schema
    for sample in sorted(SCENARIOS.glob("*.json")):
        try:
            data = load(sample)
            jsonschema.validate(data, scenario_schema)
            print(f"  ok   scenario:     {sample.relative_to(ROOT)}")
        except jsonschema.ValidationError as exc:
            print(f"  FAIL scenario:     {sample.relative_to(ROOT)}: {exc.message}", file=sys.stderr)
            failed += 1
        except Exception as exc:  # pragma: no cover
            print(f"  FAIL scenario:     {sample.relative_to(ROOT)}: {exc}", file=sys.stderr)
            failed += 1

    # 3. golden expected files only need to be valid JSON; their structure is project-internal
    for g in sorted(GOLDEN.glob("*.expected.json")):
        try:
            load(g)
            print(f"  ok   golden:       {g.relative_to(ROOT)}")
        except Exception as exc:  # pragma: no cover
            print(f"  FAIL golden:       {g.relative_to(ROOT)}: {exc}", file=sys.stderr)
            failed += 1

    # 4. metrics.schema fixture roundtrip (M-3): build a minimal valid snapshot
    #    so a schema regression breaks verify.sh.
    metrics_fixture = {
        "scenario_id": "smoke",
        "tick_t": 0,
        "metrics": [
            {
                "name": "orbitops_beam_snr_db",
                "labels": {"beam_id": "beam-1"},
                "value": 12.5,
                "unit": "dB",
            }
        ],
    }
    try:
        jsonschema.validate(metrics_fixture, metrics_schema)
        print("  ok   metrics:      smoke fixture validates")
    except jsonschema.ValidationError as exc:
        print(f"  FAIL metrics:      fixture: {exc.message}", file=sys.stderr)
        failed += 1

    # 5. copilot-response.schema fixture roundtrip
    copilot_fixture = {
        "evidence": {
            "metrics_used": [],
            "logs_used": [],
            "scenario_id": None,
            "timestamp": "2026-04-30T00:00:00Z",
        },
        "recommended_actions": [],
        "confidence": 0.0,
        "unknowns": [],
        "status": "INSUFFICIENT_EVIDENCE",
    }
    try:
        jsonschema.validate(copilot_fixture, copilot_schema)
        print("  ok   copilot:      smoke fixture validates")
    except jsonschema.ValidationError as exc:
        print(f"  FAIL copilot:      fixture: {exc.message}", file=sys.stderr)
        failed += 1

    if failed:
        print(f"\nvalidate_schemas: {failed} failure(s)", file=sys.stderr)
        return 1
    print("validate_schemas: all good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
