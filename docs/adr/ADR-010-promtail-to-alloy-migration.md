# ADR-010 — Migrate promtail → Grafana Alloy

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-05-03 |
| Supersedes | none (clarifies VS-10b.1 / PR #56 transport choice) |
| Superseded by | none |

## Context

PR #56 (VS-10b.1, 2026-05-02) added `grafana/promtail:3.4.0` to
`deploy/docker-compose.yml` as the log shipper for the new Loki +
LogScraper foundation. The 2026-05-03 stack-version research
flagged that **promtail reached end-of-life in March 2026**:

> "Promtail is officially EOL March 2026. Grafana Labs requires
> migration to **Grafana Alloy** for existing Loki-server deployments."
> — `community.grafana.com/t/promtail-end-of-life-eol-march-2026`

OrbitOps Copilot adopted promtail two months *after* it was already
deprecated. Continuing on promtail means:

- Zero upstream security fixes (only the EOL announcement counts).
- Increasing drift from Grafana docs / community examples that all
  pivot to Alloy.
- A forced migration in Sprint-3 or beyond that touches the same
  surface (compose + K8s) we're already touching for D1/D2 drift fixes.

Grafana Alloy is Grafana Labs' opentelemetry-native collector — it
replaces promtail (logs), Grafana Agent (metrics + traces), and parts
of OpenTelemetry Collector with one binary. For OrbitOps Copilot's
Sprint-2 scope it's used purely as a log forwarder to Loki, mirroring
the function promtail served in PR #56.

## Decision

Replace `grafana/promtail:3.4.0` with `grafana/alloy:v1.6.1` (latest
stable as of 2026-05-03) in **the same PR** that bumps Prometheus
(U1) and Grafana (U2) — combining all three under a single
`chore/sprint-2-prod-cve-drift-fix` lands the change while we're
already restarting the observability stack.

Specifics:
- Replace `services.promtail` block in `deploy/docker-compose.yml`
  with a `services.alloy` block using `grafana/alloy:v1.6.1` and the
  same `:ro` mounts (`/var/run/docker.sock` + `/var/lib/docker/containers`).
- Replace `observability/promtail/promtail-config.yaml` with
  `observability/alloy/config.alloy` using Alloy's River-syntax
  declarative pipeline:
    `loki.source.docker` discovers containers via the docker socket
    + relabels container_name → `service` (drops leading slash)
    + `keep` filter on `orbitops-*` containers → `loki.write` to
    `http://loki:3100/loki/api/v1/push`.
- Container name `orbitops-alloy` (vs `orbitops-promtail`) so the
  promtail self-filter still excludes it from re-ingestion (the
  `orbitops-*` regex matches both names; intentional).
- LogQL contract unchanged: `{service=~"orbitops-.*"}` still matches
  every emulator/copilot/UI/Grafana/etc. log line.
- `LokiLogScraper` (in `services/copilot-api/src/copilot_api/_log_retrieval.py`)
  needs zero code changes — it queries Loki, not the shipper.
- K8s overlay parity (deferred from VS-10b.1): the same PR now adds
  `deploy/k8s/base/alloy-{deployment,service,configmap}.yaml` so K8s
  installs also get log shipping; AC-S005-5 met on K8s path too.

## Alternatives considered

### Stay on promtail 3.4.0

**Rejected** — EOL means no security fixes. Sprint-3 or
Sprint-4 will be forced to migrate anyway; deferring just adds
debt and risks a CVE we'd own.

### Use OpenTelemetry Collector (otelcol)

**Rejected** — otelcol has stronger ecosystem support but no Loki-
native receiver; we'd hand-roll a logs-export pipeline. Alloy ships
`loki.write` and `loki.source.docker` first-class. For the Sprint-2
"Loki ergonomics" goal, Alloy is the lower-cost path.

### Stay on promtail until Sprint-3 / VS-13

**Rejected** — D1/D2 drift fixes already touch the same observability
surface. Bundling Alloy into the same PR avoids a second restart cycle
later. Two restarts > one restart for the same operator value.

## Consequences

### Accepted

- Configuration syntax shifts from YAML (`scrape_configs`) to River
  (`loki.source.docker { ... }`). Operators familiar with promtail
  must learn River; documented in `observability/alloy/config.alloy`
  header comment + `README.md`.
- Compose container name changes (`orbitops-promtail` →
  `orbitops-alloy`). Existing volumes are throwaway (positions file
  in `/tmp` per VS-10b.1 design); first run after upgrade tails from
  HEAD instead of replaying old entries. Acceptable for the demo.

### Eliminated

- The "we shipped EOL software" footgun.
- The "K8s parity for log shipping" deferred item from VS-10b.1.

### Test impact

- **Zero TDD gate impact** — `_log_retrieval.LokiLogScraper` and its
  8 tests don't move; the shipper is invisible to the consumer.
- `verify.sh` 5b/5 must remain green after the swap (no chart-template
  changes; just new k8s base files in the kustomize render).
- Manual verification: `docker compose up`, write some emulator log,
  confirm Loki receives it via `curl 'http://localhost:3100/loki/api/v1/query?query={service=~"orbitops-.*"}'`.

## References

- Promtail EOL announcement (2026-03):
  https://community.grafana.com/t/promtail-end-of-life-eol-march-2026-how-to-migrate-to-grafana-alloy-for-existing-loki-server-deployments/159636
- Grafana Alloy releases:
  https://github.com/grafana/alloy/releases (1.6.1 as of 2026-05-03)
- Alloy `loki.source.docker` component docs (River syntax):
  https://grafana.com/docs/alloy/latest/reference/components/loki.source.docker/
- VS-10b.1 PR #56 (introduced promtail; this ADR retires that choice).
