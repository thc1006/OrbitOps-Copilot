"""TDD red-phase tests for SPEC-001 scenario_generator.

These document the v2 contract from docs/specs/SPEC-001-scenario-generator.md
and are written BEFORE the implementation. Initial run must show real failures
for every test that exercises a not-yet-implemented behaviour.

Once `generate()` / `list_scenarios()` / `write_to()` / __main__ are implemented,
all tests must pass without any @xfail.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = json.loads((ROOT / "tests" / "contracts" / "scenario.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
GOLDEN_DIR = ROOT / "tests" / "golden"
KNOWN_SCENARIOS = ("beam-degradation", "handover-failure", "gateway-fallback")


# --- list_scenarios -----------------------------------------------------------


def test_list_scenarios_returns_three_known_names() -> None:
    from scenario_generator import list_scenarios

    names = list_scenarios()
    assert set(names) >= set(KNOWN_SCENARIOS), f"missing one of {KNOWN_SCENARIOS}: got {names}"


# --- generate: schema validity ------------------------------------------------


@pytest.mark.parametrize("scenario_name", KNOWN_SCENARIOS)
def test_generate_returns_dict_valid_against_schema(scenario_name: str) -> None:
    from scenario_generator import generate

    scenario = generate(scenario_name, seed=42)
    errors = sorted(VALIDATOR.iter_errors(scenario), key=lambda e: e.path)
    assert errors == [], f"schema errors: {[e.message for e in errors]}"


# --- generate: required top-level fields per user prompt ---------------------


REQUIRED_TOP_LEVEL_FIELDS = {
    "scenario_id",
    "start_time",
    "duration_seconds",
    "satellite_id",
    "ground_station_id",
    "beams",
    "events",
    "expected_anomaly",
}


@pytest.mark.parametrize("scenario_name", KNOWN_SCENARIOS)
def test_generate_includes_required_top_level_fields(scenario_name: str) -> None:
    from scenario_generator import generate

    scenario = generate(scenario_name, seed=42)
    missing = REQUIRED_TOP_LEVEL_FIELDS - scenario.keys()
    assert not missing, f"missing fields: {missing}"


# --- generate: AC-001 invariants for beam-degradation ------------------------


def test_beam_degradation_preserves_ac_001_invariants() -> None:
    """AC-001 says: scenario_id == 'beam-degradation-001', t=60s snr_drop on
    beam-1, magnitude 6 dB, duration 90s. The generator must preserve these
    fixed invariants for the canonical demo scenario regardless of seed."""
    from scenario_generator import generate

    scenario = generate("beam-degradation", seed=42)
    assert scenario["scenario_id"] == "beam-degradation-001"

    snr_drops = [
        ev for ev in scenario["events"] if ev["type"] == "snr_drop" and ev["target"] == "beam-1"
    ]
    assert snr_drops, "expected an snr_drop event on beam-1"
    ev = snr_drops[0]
    assert ev["t_offset_seconds"] == 60
    assert ev["duration_seconds"] == 90
    assert ev["magnitude_db"] == pytest.approx(6.0)
    assert scenario["expected_anomaly"]["type"] == "snr_drop"
    assert scenario["expected_anomaly"]["target"] == "beam-1"


# --- generate: deterministic seed --------------------------------------------


@pytest.mark.parametrize("scenario_name", KNOWN_SCENARIOS)
def test_generate_is_deterministic_with_same_seed(scenario_name: str) -> None:
    from scenario_generator import generate

    a = generate(scenario_name, seed=42)
    b = generate(scenario_name, seed=42)
    assert a == b, "same (scenario, seed) must yield identical dict"


# --- generate: invalid scenario name ----------------------------------------


def test_generate_unknown_scenario_raises_value_error() -> None:
    from scenario_generator import generate

    with pytest.raises(ValueError, match="unknown scenario"):
        generate("does-not-exist", seed=42)


# --- golden snapshot test ---------------------------------------------------


@pytest.mark.parametrize("scenario_name", KNOWN_SCENARIOS)
def test_generate_matches_golden_snapshot(scenario_name: str) -> None:
    """The committed tests/golden/<name>.expected.json captures the canonical
    seed=42 output. Any drift in scenario_generator output triggers a hard fail
    here, forcing an explicit regenerate-and-review step."""
    from scenario_generator import generate

    actual = generate(scenario_name, seed=42)
    expected_path = GOLDEN_DIR / f"{scenario_name}.expected.json"
    expected = json.loads(expected_path.read_text())
    assert actual == expected, (
        f"golden drift for {scenario_name!r}; "
        f"if intentional, re-run `python -m scenario_generator generate --scenario {scenario_name} --seed 42` "
        f"and update {expected_path.relative_to(ROOT)}"
    )


# --- write_to ---------------------------------------------------------------


def test_write_to_writes_valid_json_file(tmp_path: Path) -> None:
    from scenario_generator import generate, write_to

    scenario = generate("beam-degradation", seed=42)
    out = tmp_path / "out.json"
    written = write_to(scenario, out)
    assert written == out
    on_disk = json.loads(out.read_text())
    assert on_disk == scenario


# --- CLI --------------------------------------------------------------------


def test_cli_generate_writes_file_and_exits_zero(tmp_path: Path) -> None:
    out = tmp_path / "beam-degradation.json"
    cmd = [
        sys.executable,
        "-m",
        "scenario_generator",
        "generate",
        "--scenario",
        "beam-degradation",
        "--seed",
        "42",
        "--out",
        str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    assert proc.returncode == 0, f"CLI failed: stderr={proc.stderr}, stdout={proc.stdout}"
    assert out.exists(), "CLI did not write the output file"
    on_disk = json.loads(out.read_text())
    VALIDATOR.validate(on_disk)


def test_cli_unknown_scenario_exits_two(tmp_path: Path) -> None:
    out = tmp_path / "should-not-exist.json"
    cmd = [
        sys.executable,
        "-m",
        "scenario_generator",
        "generate",
        "--scenario",
        "does-not-exist",
        "--out",
        str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    assert proc.returncode == 2, f"expected exit 2 for unknown scenario, got {proc.returncode}"
    assert not out.exists()


# --- AC-001 cross-reference (H-3) -------------------------------------------


def test_ac001_scenario_id_matches_generator_output() -> None:
    """If AC-001 references a scenario_id, the generator's beam-degradation
    output must use the same id. Catches drift between ACs and templates."""
    from scenario_generator import generate

    ac_text = (ROOT / "docs" / "acceptance" / "AC-001-beam-quality-copilot.md").read_text()
    expected_id = generate("beam-degradation", seed=42)["scenario_id"]
    assert expected_id in ac_text, (
        f"AC-001 does not reference scenario_id={expected_id!r}; "
        f"either AC-001 or the beam-degradation template drifted"
    )


def test_ac001_required_keywords_subset_of_generator_keywords() -> None:
    """AC-001 says the answer must contain 'beam-1', 'SNR', 'degrad'. Those
    must appear (case-insensitive) in expected_anomaly.keywords."""
    from scenario_generator import generate

    scenario = generate("beam-degradation", seed=42)
    keywords_lower = " ".join(scenario["expected_anomaly"]["keywords"]).lower()
    for required in ("beam-1", "snr", "degrad"):
        assert required in keywords_lower, (
            f"AC-001 required token {required!r} missing from "
            f"expected_anomaly.keywords={scenario['expected_anomaly']['keywords']}"
        )


# --- internal validation (H-2) ----------------------------------------------


def test_generate_default_validates_output() -> None:
    """generate(validate=True) (the default) must raise ValueError if a future
    builder regression produces schema-invalid output. We simulate by
    monkey-patching a builder."""
    import scenario_generator
    from scenario_generator._templates import TEMPLATE_BUILDERS

    def bad_builder(_rng):  # type: ignore[no-untyped-def]
        return {"scenario_id": "x"}  # missing required fields

    saved = TEMPLATE_BUILDERS["beam-degradation"]
    TEMPLATE_BUILDERS["beam-degradation"] = bad_builder
    try:
        with pytest.raises(ValueError, match="schema-invalid"):
            scenario_generator.generate("beam-degradation", seed=42)
    finally:
        TEMPLATE_BUILDERS["beam-degradation"] = saved


def test_generate_validate_false_skips_check() -> None:
    """generate(validate=False) must NOT raise on bad output (CLI --no-validate)."""
    import scenario_generator
    from scenario_generator._templates import TEMPLATE_BUILDERS

    def bad_builder(_rng):  # type: ignore[no-untyped-def]
        return {"scenario_id": "x"}

    saved = TEMPLATE_BUILDERS["beam-degradation"]
    TEMPLATE_BUILDERS["beam-degradation"] = bad_builder
    try:
        out = scenario_generator.generate("beam-degradation", seed=42, validate=False)
        assert out == {"scenario_id": "x"}
    finally:
        TEMPLATE_BUILDERS["beam-degradation"] = saved
