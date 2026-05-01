"""Unit test for the AC-drift detector inside scripts/validate_schemas.py.

Locks in Finding K (PR #13): the gate previously printed `ok AC drift`
even when drift was present because `all(... for _ in [])` is vacuously
True. Now the gate has a dedicated `ac_drift_failures` counter; this test
asserts it actually fails (exit 1) when a v1 path is planted.

Also locks in PR #N's tightened skip rule: a line containing "migration"
that isn't an explicit `> v1:` blockquote or "ADR-007 migration table"
mention should NOT be exempted from the scan.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "validate_schemas.py"


@pytest.fixture
def isolated_repo(tmp_path: Path) -> Path:
    """Build a minimal fixture that mirrors the repo layout the script
    expects, so we can plant AC files without touching the real repo."""
    fake = tmp_path / "fake-repo"
    fake.mkdir()
    # Copy real schemas + scenarios so the earlier gates (1-5) all pass.
    for sub in ("tests/contracts", "tests/golden", "packages/scenarios",
                "packages/nephio-stubs/orbitops-groundstation-package"):
        src = REPO_ROOT / sub
        dst = fake / sub
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst)
    # Empty AC dir; tests will plant files here.
    (fake / "docs" / "acceptance").mkdir(parents=True)
    # The script lives in <root>/scripts/; we copy it so the parent walk
    # resolves to `fake/`.
    (fake / "scripts").mkdir()
    shutil.copy(SCRIPT, fake / "scripts" / "validate_schemas.py")
    return fake


def _run(script_root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", "scripts/validate_schemas.py"],
        cwd=script_root,
        capture_output=True,
        text=True,
    )


def test_drift_detector_passes_when_ac_clean(isolated_repo: Path) -> None:
    """Baseline: a v2-only AC file passes the drift gate."""
    (isolated_repo / "docs" / "acceptance" / "AC-001-fake.md").write_text(
        "# AC-001\n\n- evidence.metrics_used cites orbitops_beam_snr_db.\n"
        "- confidence is at top level (v2).\n"
    )
    result = _run(isolated_repo)
    assert result.returncode == 0, result.stderr
    assert "ok   AC drift:" in result.stdout


def test_drift_detector_fails_on_v1_confidence_path(isolated_repo: Path) -> None:
    """Finding K regression test: a planted `evidence.confidence` reference
    must trip the gate (exit 1, no 'ok' line)."""
    (isolated_repo / "docs" / "acceptance" / "AC-001-fake.md").write_text(
        "# AC-001\n\n- evidence.confidence >= 0.5 (this is a v1 path!)\n"
    )
    result = _run(isolated_repo)
    assert result.returncode == 1
    assert "FAIL AC drift" in result.stderr
    # Must NOT print the success banner — that was the original Finding K bug.
    assert "ok   AC drift:" not in result.stdout


def test_drift_detector_fails_on_v1_metric_name(isolated_repo: Path) -> None:
    """Catches `orbitops_snr_db{...}` (v1) when v2 uses `orbitops_beam_snr_db`."""
    (isolated_repo / "docs" / "acceptance" / "AC-002-fake.md").write_text(
        '# AC-002\n\n- query: `orbitops_snr_db{beam_id="beam-1"}`\n'
    )
    result = _run(isolated_repo)
    assert result.returncode == 1
    assert "orbitops_snr_db{" in result.stderr


def test_skip_rule_only_exempts_explicit_breadcrumbs(isolated_repo: Path) -> None:
    """Tightened skip rule: a line that *casually* contains the word
    'migration' should NOT be exempted. Only `> v1: …` blockquotes and
    `ADR-007 migration table` references are allowed to mention v1 paths."""
    # Casual "migration" usage with an embedded v1 path → MUST fail.
    (isolated_repo / "docs" / "acceptance" / "AC-003-fake.md").write_text(
        "# AC-003\n\nWe plan migration of evidence.confidence to top level.\n"
    )
    result = _run(isolated_repo)
    assert result.returncode == 1, "casual 'migration' usage should not exempt v1 paths"
    assert "evidence.confidence" in result.stderr


def test_skip_rule_allows_quoted_v1_breadcrumb(isolated_repo: Path) -> None:
    """`> v1: evidence.confidence` is a deliberate ADR breadcrumb and must
    be exempted so historical migration notes don't trip the gate."""
    (isolated_repo / "docs" / "acceptance" / "AC-004-fake.md").write_text(
        "# AC-004\n\n"
        "Field is now at top level.\n"
        "> v1: evidence.confidence (kept as historical breadcrumb)\n"
    )
    result = _run(isolated_repo)
    assert result.returncode == 0, result.stderr
    assert "ok   AC drift:" in result.stdout
