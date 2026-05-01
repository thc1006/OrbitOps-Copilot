"""scenario_generator CLI.

Usage:
    python -m scenario_generator generate --scenario beam-degradation --seed 42
    python -m scenario_generator generate --scenario beam-degradation --out path/to/file.json
    python -m scenario_generator list

Exit codes:
    0  success
    1  schema validation failed
    2  unknown scenario name
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from . import generate, list_scenarios, write_to


def _find_schema() -> Path | None:
    candidates = [
        Path.cwd() / "tests" / "contracts" / "scenario.schema.json",
        Path(__file__).resolve().parents[4] / "tests" / "contracts" / "scenario.schema.json",
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None


def _validate(scenario: dict) -> None:
    schema_path = _find_schema()
    if schema_path is None:
        raise FileNotFoundError(
            "scenario.schema.json not found in cwd or repo tree"
        )
    from jsonschema import Draft202012Validator

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(scenario)


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="scenario_generator")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="Generate a scenario JSON.")
    g.add_argument("--scenario", required=True, help="scenario name (see `list`)")
    g.add_argument("--seed", type=int, default=42, help="random seed (default: 42)")
    g.add_argument(
        "--out",
        default=None,
        help="output path (default: packages/scenarios/<scenario_id>.json)",
    )
    g.add_argument(
        "--no-validate",
        action="store_true",
        help="skip JSON-schema validation (not recommended)",
    )

    sub.add_parser("list", help="List known scenario names.")

    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    if args.cmd == "list":
        for name in list_scenarios():
            print(name)
        return 0

    # cmd == "generate"
    try:
        scenario = generate(args.scenario, seed=args.seed)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if not args.no_validate:
        try:
            _validate(scenario)
        except Exception as exc:  # noqa: BLE001
            print(f"schema validation failed: {exc}", file=sys.stderr)
            return 1

    out = (
        Path(args.out)
        if args.out
        else Path("packages/scenarios") / f"{scenario['scenario_id']}.json"
    )
    write_to(scenario, out)
    print(f"wrote {out} (scenario_id={scenario['scenario_id']}, seed={args.seed})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
