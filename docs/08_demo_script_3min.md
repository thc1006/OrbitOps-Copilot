# 08 — 3-Minute Demo Script (English subtitled)

| Time | Visual | Subtitle |
|---|---|---|
| 0:00–0:20 | Title + map of Taiwan with LEO satellite trajectory | "Taiwan's B5G LEO program will fly its first Ka-band satellite around 2027. Payload partners are public — but the ground-station operations toolchain is not." |
| 0:20–0:40 | Cloud icon + Kubernetes badge | "OrbitOps Copilot is a cloud-native operations digital twin: Kubernetes (kind/k3d), Prometheus, Grafana, FastAPI, React, CesiumJS — and an evidence-grounded LLM copilot." |
| 0:40–1:10 | UC1 walkthrough on screen | "We load `beam-degradation.json`. The emulator emits SNR, SINR, latency, packet loss, Doppler residual, elevation, handover state. We ask: 'which beam is degrading and why?'" |
| 1:10–1:30 | Copilot panel showing evidence JSON | "The copilot replies, citing orbitops_beam_snr_db{beam_id='beam-1'}=6.5 dB. Every response carries an evidence block (metrics_used + recommended_actions + unknowns) — no hallucinations allowed." |
| 1:30–1:50 | UC2 — handover failure + pod health drop | "Now a handover failure plus a gateway pod going unhealthy. We click Generate Runbook." |
| 1:50–2:10 | 5-step runbook in collapsible UI | "Five steps: what, why, action, risk, next observation window. Backed by the same evidence pipeline." |
| 2:10–2:30 | Mermaid arch + boundary callouts | "The architecture is honest about its boundaries: simulation today, real ray-traced channels tomorrow, real RAN stack the day after." |
| 2:30–2:50 | Roadmap timeline | "3GPP Rel-19 NTN frozen December 2025. Rel-20 freezes September 2026. NVIDIA Aerial open-sourced under Apache 2.0. Sionna RT v2.0.1. We're on the standards path." |
| 2:50–3:00 | Closing card | "OrbitOps Copilot. Operations twin for the ground segment that does not exist yet." |

## Production notes

- All on-screen text in English; no team / school / personal identifiers.
- After export: `exiftool -all= demo-3min.mp4`.
- If voiceover used, neutralize accent / use TTS to avoid identifiability.

## Demo execution checklist (VS-8 minimal — strict 4-step click flow)

> **Why this exists**: A fresh UI session with the emulator at the default
> `t=0` (before any anomaly fires) — or worse, parked past a finished
> anomaly window — will make Copilot return `INSUFFICIENT_EVIDENCE` with
> `metrics_used=[]`. By design (PR-β: defensive degrade, no fabrication),
> but a RunSpace evaluator who skips Step 1+2 will mistake it for a broken
> Copilot. Driver: PR #38 audit doc `docs/reviews/demo-path-audit-2026-05-01.md`
> "UX nit" section.
>
> The 4-step flow below is **deterministic and reproducible** against
> `packages/scenarios/beam-degradation.json` (which fires a 6 dB
> `snr_drop` on `beam-1` from `t=60s` for 90s). Hitting `t=90s` lands
> mid-anomaly; this is what the demo footage at 0:40 onwards depicts.

### Pre-roll (off-camera; ≤ 30 s)

1. Bring the stack up (one of):
   - **docker-compose path**: `make dev-up` → wait for `make dev-up` healthcheck completion (~5 s).
   - **k8s path**: `make k8s-up` (containerd kubeadm; uses sudo) OR `make k8s-up-kind` (kind cluster). Both wait for pods Ready before returning.
2. Confirm endpoints respond:
   - emulator: `curl -fsS http://localhost:8000/healthz` (compose) or `:30080` (k8s NodePort).
   - copilot:  `curl -fsS http://localhost:8001/healthz` (compose) or `:30081`.
   - UI:       `curl -fsS http://localhost:5173` (compose dev) or `:30073` (k8s NodePort).
   - grafana:  `:30030` (k8s) or `:3000` (compose).

### On-camera 4-step click flow

| # | Page | Action | Expected state | Camera-cut anchor |
|---|---|---|---|---|
| 1 | **Scenarios** | Click **Load Scenario** (preset `beam-degradation`) | UI shows `loaded=beam-degradation-001`, `t=0`, 3 beams | 0:40 (UC1 walkthrough begins) |
| 2 | **Scenarios** | Click **Tick +90s** (or set 90 in field then **Tick**) | UI shows `t=90`, `active_anomalies=["snr_drop"]` | (still 0:40–1:10 window) |
| 3 | **Copilot** | Type `Which beam is degrading and why?` → submit | Response within ~1 s: `status=ok`, `summary` cites `orbitops_beam_snr_db{beam_id="beam-1"}=6.5 dB`, confidence ≈ 0.78, 3 ranked actions | 1:10 (Copilot panel reveal) |
| 4 | **Grafana** (split-screen optional) | Switch to OrbitOps Overview dashboard `/d/orbitops-overview` | All 8 panels rendering live data; "Beam SNR (dB)" panel shows the 6.5 dB drop on `beam-1` over the 60–150 s window | 1:30 (UC2 transition) |

### Post-anomaly notes

- The `snr_drop` event runs `t=60..150 s`. **Do not tick past `t=150`** during recording — SNR snaps back to 12.5 dB and the demo loses its hook.
- For UC2 footage (1:30–2:10), reset with **Load Scenario** picking `handover-failure.json` (90 s `handover_failure` event on beam-1 from `t=30`). Same 4-step flow with `Generate Runbook` instead of free-text question.
- If recording stalls or the timer overshoots, **reload the scenario** from Step 1 — it's idempotent and resets `t` to 0.

### Failure modes to AVOID on camera

| Symptom | Root cause | Fix |
|---|---|---|
| Copilot returns `INSUFFICIENT_EVIDENCE` | Skipped Step 1 + 2 (no scenario loaded, or `t < 60`) | Re-do Steps 1–3 in order |
| Copilot returns `INSUFFICIENT_EVIDENCE` after Step 2 | Ticked past `t=150` (anomaly already ended) | Reload scenario |
| Grafana panel count = 7 (no Beam Elevation panel) | Live ConfigMap stale post obs PR | Off-camera: `make k8s-reload-observability` (VS-7 target; PR #40) — restarts Grafana and Prometheus |
| `/ask` 4xx with CORS error in browser console | UI's `VITE_*` URL doesn't match cluster NodePort | Set `VITE_COPILOT_BASE_URL` / `VITE_EMULATOR_BASE_URL` in `services/digital-twin-ui/.env` and rebuild UI |
