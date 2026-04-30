#!/usr/bin/env bash
# dev-up.sh — local docker-compose dev environment.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker required" >&2; exit 1
fi

docker compose -f deploy/docker-compose.yml up -d --remove-orphans
echo
echo "  UI:        http://localhost:5173      (Sprint 1)"
echo "  Copilot:   http://localhost:8001/healthz   (Sprint 1)"
echo "  Emulator:  http://localhost:8000/metrics   (Sprint 1)"
echo "  Prom:      http://localhost:9090"
echo "  Grafana:   http://localhost:3000   (admin/admin first run)"
