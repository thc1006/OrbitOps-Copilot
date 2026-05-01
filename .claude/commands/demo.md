---
description: Run the end-to-end demo and capture evidence for AC-004.
disable-model-invocation: true
allowed-tools: Bash(make dev-up), Bash(make demo), Bash(scripts/run-demo.sh), Bash(make dev-down), Read
---

Bring services up (`make dev-up`), wait for health, run `scripts/run-demo.sh`, then read `tmp/demo-output.json` and verify it satisfies AC-004 (`docs/acceptance/AC-004-demo-replay.md`).

Report: status, evidence summary, any deviations. Tear down with `make dev-down`.

Do NOT push, deploy to a remote cluster, or upload anywhere.
