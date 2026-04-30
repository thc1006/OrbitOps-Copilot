---
name: observability-dashboard
description: Author / refine Prometheus scrape config, recording rules, and Grafana dashboards. UC1/UC2 anomalies must be visible within 30 seconds.
---

## Overview

Owns `observability/`. Demand from SPEC-005 / ADR-003: anomaly visible on dashboard within 30 s of injection. P0 = Prometheus + Grafana; P1 = Loki + Tempo + Alloy.

## Triggers

- Editing `observability/prometheus/` or `observability/grafana/`.
- Adding a new metric to `tests/contracts/metrics.schema.json` (must surface in dashboard).
- Slash command `/implement SPEC-005`.
- Slack-of-the-future: a UC fails the "30-second visibility" rule.

## Inputs

- `docs/specs/SPEC-005-observability.md`
- `docs/adr/ADR-003-prometheus-grafana.md`
- `tests/contracts/metrics.schema.json` (canonical metric names).

## Step-by-step workflow

1. Identify metric(s) to surface. Confirm enum membership in `metrics.schema.json`.
2. Edit `observability/grafana/dashboards/orbitops-overview.json`:
   - Add panel with proper `datasource: { type: prometheus, uid: prometheus }`.
   - Use `legendFormat` referencing label keys (e.g. `{{ beam_id }}`).
   - Set `unit` (dB, ms, Hz, ratio, none).
3. Validate dashboard JSON is parseable: `python3 -c "import json,sys; json.load(open(sys.argv[1]))" observability/grafana/dashboards/orbitops-overview.json`.
4. (P1) Add `*.rules.yml` recording rule; `promtool check rules` must pass.
5. (P1) `loki/` config: only logs needed for AC-002 mock-log evidence.
6. Run dev stack `make dev-up`, inject anomaly via emulator, watch dashboard auto-update — confirm 30 s rule.
7. Screenshot dashboard for PR (anonymized — no team / desktop chrome).

## Output format

- Updated dashboard JSON
- (P1) recording rules YAML
- PR includes screenshot of anomaly visible

## Verification checklist

- [ ] Dashboard JSON parses (Python json.load).
- [ ] Every panel uses a valid metric name (cross-checked against schema enum).
- [ ] No hard-coded threshold inside dashboard JSON (use templating var if needed).
- [ ] (P1) `promtool check rules` exits 0.
- [ ] Anomaly visible in ≤ 30 s (manual or scripted check).
- [ ] No PII in dashboard title, panel description, or screenshot.

## Common failure modes

- Hard-coded `datasource: "Prometheus"` (legacy syntax) — fails Grafana 13 schema.
- Mistyped legend `{{beam-id}}` (hyphens vs underscores).
- Using `count(orbitops_anomaly_active)` instead of `sum(...)` — counts series not values.
- Forgetting `refresh: 5s` makes the 30-second SLA infeasible.

## Forbidden actions

- Importing third-party dashboards without source attribution.
- Adding metrics absent from the schema enum.
- Setting alert thresholds in P0 (alertmanager not in scope).
- Embedding base64-encoded image assets that may carry EXIF metadata.
