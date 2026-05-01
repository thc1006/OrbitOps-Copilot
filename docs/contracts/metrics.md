# OrbitOps Metrics Contract

| Field | Value |
|---|---|
| Owner | observability-engineer + ran-ntn-engineer |
| Status | Active (Sprint 1, supersedes draft in `tests/contracts/metrics.schema.json` v1) |
| Last updated | 2026-04-30 |
| Source of truth (machine-readable) | [`tests/contracts/metrics.schema.json`](../../tests/contracts/metrics.schema.json) |

## 1. Purpose

This document is the **single human-readable contract** between
`ntn-metrics-emulator` (producer), `copilot-api` (consumer of evidence),
and `observability/grafana/dashboards/orbitops-overview.json` (consumer of
PromQL). Any change to a metric name, label set, unit, or value semantics
**must** update this file in the same PR as the schema and the producer.

## 2. HTTP API of the emulator

| Method | Path | Body | 200 response | Other |
|---|---|---|---|---|
| `GET` | `/healthz` | — | `{"status":"ok"}` | — |
| `POST` | `/scenario/load` | `Scenario` JSON (per `scenario.schema.json` v2) | `{"loaded":"<scenario_id>","t":0,"beams":N,"gateways":M}` | `400` on schema-invalid body |
| `POST` | `/scenario/tick` | `{"seconds": int}` (default `1`) | `{"t":<int>,"active_anomalies":[...]}` | `409` if no scenario loaded |
| `GET` | `/scenario/current` | — | `{"scenario_id","t","scenario":{...}}` | `404` if no scenario loaded |
| `GET` | `/metrics` | — | Prometheus text exposition (`text/plain; version=...`; legacy 0.0.4 or OpenMetrics 1.0.0 — both scrapeable by Prometheus 3.x) | — |

Determinism: same scenario + same tick sequence + same seed (default `42`) →
identical `/metrics` body. Tick advances simulated time `t` (seconds since
scenario `start_time`); it does **not** wait wall-clock.

## 3. Metric catalog

| # | Name | Type | Labels | Unit | Range / domain | Definition |
|---|---|---|---|---|---|---|
| 1 | `orbitops_beam_snr_db` | Gauge | `beam_id` | dB | -10 … +30 | Per-beam carrier-to-noise ratio at simulated time `t`. Baseline depends on `boresight_el_deg`; reduced by active `snr_drop` events. |
| 2 | `orbitops_beam_sinr_db` | Gauge | `beam_id` | dB | -15 … +25 | Per-beam signal-to-(interference+noise) ratio. Tracks SNR with a 2 dB interference penalty. |
| 3 | `orbitops_link_latency_ms` | Gauge | `beam_id` | ms | 25 … 75 (Sprint 1; widens in P2) | Baseline 25 ms; +50 ms while a `handover_failure` for that beam **or** any `gateway_outage` is active. |
| 4 | `orbitops_packet_loss_ratio` | Gauge | `beam_id` | ratio | 0.0 … 1.0 | Packet loss ratio per beam. Increases under `packet_loss_spike` events; clipped to ≤ 0.5. |
| 5 | `orbitops_doppler_residual_hz` | Gauge | `beam_id` | Hz | -3000 … +3000 | Residual after Doppler compensation. Spikes during `doppler_spike` events by `magnitude_hz`. |
| 6 | `orbitops_handover_state` | Gauge | `beam_id` | enum | 0,1,2 | 0 = stable; 1 = preparing; 2 = failure. Set to 2 when a `handover_failure` event targeting `beam_id` is active. |
| 7 | `orbitops_gateway_available` | Gauge | `gateway_id` | 0 / 1 | {0,1} | 1 = healthy; 0 = unavailable. Set to 0 during `gateway_outage` events targeting that gateway. |
| 8 | `orbitops_anomaly_active` | Gauge | `type` | 0 / 1 | {0,1} | 1 if any active event has `type == <type>` at current `t`. One Gauge instance per known event-type label. |
| 9 | `orbitops_beam_elevation_deg` | Gauge | `beam_id` | deg | 0 … 90 | Per-beam elevation angle. Sin-shaped over `scenario.duration_seconds`: `peak · sin(π·t/T_pass)`, clamped to `[0, 90]`. Peak from optional `scenario.satellite.pass_peak_elevation_deg` (default 55°). Sprint-1 simplification of full SGP4; defensible for ~600 km LEO passes per 3GPP TR 38.811 §6. |

`type` label of `orbitops_anomaly_active` ∈ `{snr_drop, handover_failure, doppler_spike, gateway_outage, packet_loss_spike}`.

## 4. Compute semantics（pseudocode）

```text
load(scenario):
    state.scenario = scenario
    state.t        = 0
    state.beams    = [b.beam_id for b in scenario.beams]
    state.gateways = unique(target for ev in scenario.events if ev.type == "gateway_outage") or {"gateway-default"}
    refresh_metrics(state)

tick(seconds):
    state.t += seconds
    refresh_metrics(state)

refresh_metrics(state):
    for beam in state.beams:
        snr = baseline_snr(beam) - sum(ev.magnitude_db for ev in active_events(state, beam) if ev.type == "snr_drop")
        sinr = snr - 2.0
        latency = baseline_latency(beam) + 50 if any handover_failure or gateway_outage active for beam
        loss = 0.001 + 0.3 if active packet_loss_spike for beam (clipped ≤ 0.5)
        doppler = sum(ev.magnitude_hz for ev in active_events(state, beam) if ev.type == "doppler_spike")
        ho_state = 2 if any handover_failure event active and target=beam else 0
        emit(orbitops_beam_snr_db{beam_id=beam}, snr)
        ... etc
    for gw in state.gateways:
        avail = 0 if any gateway_outage event active and target=gw else 1
        emit(orbitops_gateway_available{gateway_id=gw}, avail)
    for type in EVENT_TYPES:
        emit(orbitops_anomaly_active{type=type}, 1 if any event of that type active else 0)

active_events(state, beam):
    return [ev for ev in state.scenario.events
            if ev.t_offset_seconds <= state.t < ev.t_offset_seconds + ev.duration_seconds
            and ev.target == beam]
```

`baseline_snr(beam)` uses `8 + boresight_el_deg / 10` (so el=45 → 12.5 dB);
`baseline_latency(beam)` is fixed at 25 ms.

## 5. Determinism

The producer uses **no random noise** in Sprint 1. Output is a pure function
of `(scenario, t)`. This makes golden snapshot testing trivial and avoids the
xfail test instability that bit Sprint 0. Sprint 2+ may add seeded jitter
behind a feature flag.

## 6. Anomaly → metric mapping

| Event type | Affects | Effect |
|---|---|---|
| `snr_drop` | `orbitops_beam_snr_db{beam_id=target}`, `orbitops_beam_sinr_db{beam_id=target}` | reduce by `magnitude_db` |
| `handover_failure` | `orbitops_handover_state{beam_id=target}`, `orbitops_link_latency_ms{beam_id=target}` | state→2; latency +50 ms |
| `doppler_spike` | `orbitops_doppler_residual_hz{beam_id=target}` | += `magnitude_hz` |
| `gateway_outage` | `orbitops_gateway_available{gateway_id=target}`, `orbitops_link_latency_ms` for all beams | avail=0; latency +50 ms |
| `packet_loss_spike` | `orbitops_packet_loss_ratio{beam_id=target}` | += 0.3 (clipped 0.5) |

Plus `orbitops_anomaly_active{type=<event.type>}` = 1 while any event of that type is active.

**Default gateway placeholder:** if a scenario has zero `gateway_outage` events, the emulator emits a single `orbitops_gateway_available{gateway_id="gateway-default"} 1` so dashboards always have a series to render. Sprint 2 may replace this with a per-scenario `gateway_ids[]` field.

## 7. Backward compatibility / migration note

This contract supersedes the v1 names from earlier draft:

| v1 name | v2 name |
|---|---|
| `orbitops_snr_db` | `orbitops_beam_snr_db` |
| `orbitops_sinr_db` | `orbitops_beam_sinr_db` |
| `orbitops_latency_ms` | `orbitops_link_latency_ms` |
| `orbitops_pod_health` | (removed; not requested by user prompt) |
| `orbitops_handover_failures_total` | (removed; covered by `orbitops_handover_state` + `orbitops_anomaly_active`) |
| `orbitops_elevation_deg` | (removed; folded into baseline SNR) |
| (none) | `orbitops_gateway_available` (new) |
| (none) | `orbitops_beam_elevation_deg` (new in G7; replaces removed v1 `orbitops_elevation_deg` with explicit per-beam labelling) |

The Grafana dashboard JSON (`observability/grafana/dashboards/orbitops-overview.json`)
covers all 9 metrics above (panels 1–8 — anomaly_active is folded into the
"Active anomalies" stat panel; elevation is panel 8 added in PR #34).
The static check `scripts/check-observability.sh` enforces this — adding a
new metric here without a panel will fail CI.

## 8. Copilot anomaly classification

`copilot-api`'s `_retrieval.classify()` consumes the same evidence and assigns
one anomaly type per request. Priority (highest first; first match wins).
Source-of-truth = `services/copilot-api/src/copilot_api/_retrieval.py`.

| Priority | `anomaly_type` | Trigger metric | Notes |
|---|---|---|---|
| 1 | `snr_drop` | `orbitops_beam_snr_db < 8.0` (any beam) | AC-001 link-adaptation threshold. Most operationally severe. |
| 2 | `handover_failure` | `orbitops_handover_state ≥ 2` (state-machine "failure") | |
| 3 | `gateway_outage` | `orbitops_gateway_available < 0.5` (i.e. = 0) | |
| 4 | `doppler_compensation_warning` | `|orbitops_doppler_residual_hz| > 2000.0` | G8: 10% of NR SCS=30 kHz is the ceiling (~3 kHz); 2 kHz is the conservative early-warning gate beneath it (3GPP TS 38.821 §6 + TR 38.811 §6). |
| — | `unknown` | none of the above | LLM provider returns the `_no_relevant_evidence` shape. |

`doppler_compensation_warning` is a copilot-side classification — it does NOT
correspond to a producer-emitted `orbitops_anomaly_active{type=...}` series
(the producer only flags scenario-injected events). It is derived from raw
`orbitops_doppler_residual_hz` magnitude crossing the 2 kHz gate.
