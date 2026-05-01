#!/usr/bin/env bash
# scripts/check-observability.sh
#
# Static smoke test for the VS-2 observability stack:
# 1. prometheus.yml exists, parses as YAML
# 2. prometheus.yml scrape_configs contains ntn-metrics-emulator target
# 3. Grafana datasource provisioning exists
# 4. Grafana dashboard provider provisioning exists
# 5. orbitops-overview dashboard JSON exists, parses, contains
#    panels covering each required metric (per docs/contracts/metrics.md):
#    SNR, latency, packet loss, Doppler residual, handover state, anomaly active.
#
# This is a static check — does NOT require docker compose to be running.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

G=$'\e[32m'; R=$'\e[31m'; B=$'\e[1m'; X=$'\e[0m'
ok()   { printf "${G}  ✓${X} %s\n" "$*"; }
fail() { printf "${R}  ✗${X} %s\n" "$*" >&2; exit 1; }
hdr()  { printf "${B}── %s ──${X}\n" "$*"; }

PROM=observability/prometheus/prometheus.yml
DASH=observability/grafana/dashboards/orbitops-overview.json
DS=observability/grafana/provisioning/datasources/prometheus.yaml
PROV=observability/grafana/provisioning/dashboards/orbitops.yaml

hdr "1. Prometheus config"
[[ -f "$PROM" ]] || fail "missing $PROM"
python3 -c "import yaml,sys; yaml.safe_load(open('$PROM'))" 2>/dev/null \
  || fail "$PROM is not valid YAML"
ok "$PROM parses"

grep -q "ntn-metrics-emulator" "$PROM" \
  || fail "$PROM lacks ntn-metrics-emulator scrape target"
ok "scrape target ntn-metrics-emulator present"

grep -q "copilot-api" "$PROM" \
  || fail "$PROM lacks copilot-api scrape target"
ok "scrape target copilot-api present"

hdr "2. Grafana provisioning"
[[ -f "$DS" ]]   || fail "missing datasource provisioning $DS"
[[ -f "$PROV" ]] || fail "missing dashboard provisioning $PROV"
ok "datasource + dashboard provisioning files present"

grep -q "uid: prometheus" "$DS" \
  || fail "$DS lacks 'uid: prometheus'"
ok "datasource uid pinned"

grep -q "/var/lib/grafana/dashboards" "$PROV" \
  || fail "$PROV path does not match docker-compose volume mount"
ok "dashboard provider path matches compose volume"

hdr "3. Dashboard JSON"
[[ -f "$DASH" ]] || fail "missing $DASH"
python3 -c "import json; json.load(open('$DASH'))" \
  || fail "$DASH is not valid JSON"
ok "$DASH parses"

# Required metrics per docs/contracts/metrics.md. Each must appear at least
# once in a panel target expression.
REQUIRED=(
  "orbitops_beam_snr_db"
  "orbitops_beam_elevation_deg"
  "orbitops_link_latency_ms"
  "orbitops_packet_loss_ratio"
  "orbitops_doppler_residual_hz"
  "orbitops_handover_state"
  "orbitops_gateway_available"
  "orbitops_anomaly_active"
)
for metric in "${REQUIRED[@]}"; do
  grep -q "\"$metric\b" "$DASH" \
    || grep -q "$metric" "$DASH" \
    || fail "dashboard missing panel for $metric"
  ok "panel covers $metric"
done

hdr "summary"
ok "observability stack static checks pass"
