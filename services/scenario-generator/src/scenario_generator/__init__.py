"""scenario_generator — produce deterministic NTN scenario JSON.

Public API:
    generate(scenario, *, seed=42) -> dict
    list_scenarios() -> list[str]
    write_to(scenario, path) -> Path

Schema contract: tests/contracts/scenario.schema.json (v2).
SPEC: docs/specs/SPEC-001-scenario-generator.md.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from ._templates import TEMPLATE_BUILDERS

__version__ = "0.0.1.dev0"
__all__ = ["generate", "list_scenarios", "write_to", "__version__"]


def list_scenarios() -> list[str]:
    """Return the sorted list of known scenario names."""
    return sorted(TEMPLATE_BUILDERS.keys())


def _find_schema() -> Path | None:
    """Locate scenario.schema.json. Lookup order:
    1. ``ORBITOPS_CONTRACTS_DIR`` env var (point at any tests/contracts/ root)
    2. cwd-relative ``tests/contracts/scenario.schema.json``
    3. Walk upward from this file looking for ``tests/contracts/`` (handles
       editable installs at any depth — replaces fragile parents[4]).
    """
    import os

    env_dir = os.environ.get("ORBITOPS_CONTRACTS_DIR", "").strip()
    if env_dir:
        p = Path(env_dir) / "scenario.schema.json"
        if p.is_file():
            return p

    cwd_path = Path.cwd() / "tests" / "contracts" / "scenario.schema.json"
    if cwd_path.is_file():
        return cwd_path

    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "tests" / "contracts" / "scenario.schema.json"
        if candidate.is_file():
            return candidate
    return None


def generate(
    scenario: str,
    *,
    seed: int = 42,
    validate: bool = True,
) -> dict[str, Any]:
    """Build a deterministic scenario dict.

    Args:
        scenario: one of the names returned by ``list_scenarios()``.
        seed: random seed; same (scenario, seed) → identical dict.
        validate: if True (default), validate output against
            ``tests/contracts/scenario.schema.json`` before returning. Set to
            False only in tooling that has its own validator (CLI ``--no-validate``).

    Raises:
        ValueError: when ``scenario`` is not a known name, or when the produced
            dict does not satisfy the schema (caught here is a builder regression,
            not user error).
    """
    if scenario not in TEMPLATE_BUILDERS:
        raise ValueError(
            f"unknown scenario {scenario!r}; known: {list_scenarios()}"
        )
    rng = random.Random(seed)
    out = TEMPLATE_BUILDERS[scenario](rng)

    if validate:
        schema_path = _find_schema()
        if schema_path is not None:
            try:
                from jsonschema import Draft202012Validator
            except ImportError:  # pragma: no cover
                return out  # jsonschema is optional at runtime
            v = Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8")))
            errors = sorted(v.iter_errors(out), key=lambda e: list(e.path))
            if errors:
                raise ValueError(
                    f"builder for scenario {scenario!r} produced schema-invalid "
                    f"output: {[e.message for e in errors]}"
                )
    return out


def write_to(scenario: dict[str, Any], path: Path | str) -> Path:
    """Write a scenario dict to disk as canonical pretty JSON.

    The on-disk form is sorted-key, 2-space indent, trailing newline so that
    diffs are stable across regenerations.
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(scenario, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return p
