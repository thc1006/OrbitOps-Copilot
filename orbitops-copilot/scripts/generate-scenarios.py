#!/usr/bin/env python3
"""generate-scenarios.py — emit sample scenarios from templates.

Sprint 0 placeholder. Sprint 1 (S1-01) will extract this into the
scenario-generator package; for now, we keep three checked-in JSON
files in packages/scenarios/ as the source of truth.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "packages" / "scenarios"


def main() -> int:
    print("[generate-scenarios] Sprint 0 placeholder.")
    print("[generate-scenarios] checked-in scenarios:")
    for f in sorted(OUT.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            print(f"  - {f.relative_to(ROOT)} (scenario_id={data.get('scenario_id')!r})")
        except Exception as exc:
            print(f"  - {f.relative_to(ROOT)}  ERROR: {exc}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
