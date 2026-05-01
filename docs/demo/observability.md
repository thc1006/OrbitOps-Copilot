# Demo — Prometheus + Grafana stack (VS-2)

## What this proves

The OrbitOps emulator emits Prometheus metrics; Prometheus scrapes them every
5 s; Grafana provisions a dashboard automatically with panels for every metric
named in `docs/contracts/metrics.md`.

## Start

```bash
cd /path/to/orbitops-copilot
docker compose -f deploy/docker-compose.yml up -d
```

This brings up four containers:

| Container | URL | Purpose |
|---|---|---|
| `orbitops-emulator`   | http://localhost:8000 | NTN metrics emulator (`/metrics`, `/healthz`, `/scenario/*`) |
| `orbitops-copilot`    | http://localhost:8001 | Copilot API (`/ask`, `/explain`, `/runbook`) |
| `orbitops-prometheus` | http://localhost:9090 | Prometheus UI |
| `orbitops-grafana`    | http://localhost:3000 | Grafana UI |

Default credentials:

- Grafana: **admin / admin** (also anonymous Viewer access enabled for demo)
- Prometheus: no auth

The `digital-twin-ui` service is gated behind the `ui` profile (because it
requires `npm run build` to populate `services/digital-twin-ui/dist` first).
Bring it up with:

```bash
cd services/digital-twin-ui && npm install && npm run build && cd ../..
docker compose -f deploy/docker-compose.yml --profile ui up -d digital-twin-ui
# Then open http://localhost:5173
```

## Trigger a beam-degradation demo

```bash
# 1. Load the canonical scenario.
curl -s -X POST http://localhost:8000/scenario/load \
  -H 'content-type: application/json' \
  -d @packages/scenarios/beam-degradation.json | jq

# 2. Tick into the anomaly window.
curl -s -X POST http://localhost:8000/scenario/tick \
  -H 'content-type: application/json' \
  -d '{"seconds":90}' | jq

# 3. Confirm Prometheus has the data.
curl -s 'http://localhost:9090/api/v1/query?query=orbitops_beam_snr_db' | jq

# 4. Open Grafana → OrbitOps folder → "OrbitOps Overview" dashboard.
#    Beam SNR panel shows beam-1 dropping to 6.5 dB.
open http://localhost:3000/d/orbitops-overview
```

## Stop / clean

```bash
docker compose -f deploy/docker-compose.yml down -v
```

## Static check (no docker required)

```bash
./scripts/check-observability.sh
```

Verifies:

1. `observability/prometheus/prometheus.yml` parses + has `ntn-metrics-emulator` + `copilot-api` scrape targets
2. Grafana datasource + dashboard provisioning files present + valid
3. `orbitops-overview.json` covers all 6 required metrics: SNR, latency, packet loss, Doppler, handover state, anomaly active

This check is hooked into `make verify` (gate 3b), so dashboard / scrape config drift breaks CI.

## Limitations

- copilot-api `/metrics` endpoint is a forward placeholder; Sprint 2 adds
  request-count / status-distribution / token-usage instrumentation.
- No alerting rules in Sprint 1 (per ADR-003); Loki/Tempo deferred to VS-10.
- The dashboard does not auto-refresh during a demo replay — set the time
  range to "Last 15 minutes" and the refresh interval to 5 s manually.
- Image pins (Prom v3.5, Grafana 11.4) lag `docs/09` future targets to keep
  `docker compose pull` reproducible today.
