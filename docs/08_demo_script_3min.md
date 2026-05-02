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

> **Recommended path: k8s-up-kind or k8s-up.** The UI's default API base URLs target the kubeadm/kind NodePorts (`30080`/`30081`/`30090`/`30030`); the docker-compose path requires extra `VITE_*` env-var setup before `npm run build` to retarget the compose ports (see "compose path" caveat below).

1. Bring the stack up (pick one):
   - **k8s path (recommended)**: `make k8s-up` (containerd kubeadm; uses sudo) OR `make k8s-up-kind` (kind cluster). Both bring up all services including UI.
     - **kind**: NodePorts forwarded to `http://localhost:<port>` automatically.
     - **kubeadm**: NodePorts exposed on the **InternalIP** of the node (`scripts/k8s-up-local.sh` prints it; e.g. `http://31.41.34.19:<port>`). `localhost` will NOT work outside kind unless you port-forward.
   - **docker-compose path**: `make dev-up` brings up emulator + copilot + Prom + Grafana. The UI is gated behind a compose `profiles: ["ui"]` flag, so for the on-camera 4-step flow you also need:
     ```bash
     # Rebuild the UI bundle pointing at the compose ports (NOT the k8s defaults):
     (cd services/digital-twin-ui && \
       VITE_EMULATOR_BASE_URL=http://localhost:8000 \
       VITE_COPILOT_BASE_URL=http://localhost:8001 \
       VITE_PROMETHEUS_BASE_URL=http://localhost:9090 \
       VITE_GRAFANA_BASE_URL=http://localhost:3000 \
       npm run build)
     docker compose -f deploy/docker-compose.yml --profile ui up -d digital-twin-ui
     ```
     Without the env-var rebuild, the compose UI will call k8s ports (`30080`/`30081`) and every API call will fail.
2. Confirm endpoints respond. Replace `<host>` with `localhost` (kind / compose) or the kubeadm InternalIP:
   - emulator: `curl -fsS http://<host>:8000/healthz` (compose) or `http://<host>:30080/healthz` (k8s).
   - copilot:  `curl -fsS http://<host>:8001/healthz` (compose) or `http://<host>:30081/healthz` (k8s).
   - UI:       `curl -fsS http://<host>:5173` (compose) or `http://<host>:30073` (k8s).
   - grafana:  `http://<host>:3000` (compose) or `http://<host>:30030` (k8s).

### On-camera 4-step click flow

> Button labels below use the **actual** UI text from `src/pages/Scenarios.tsx` and `src/pages/Copilot.tsx` on `main`. If the UI is rebuilt with PR #42's `Ready for Copilot` button, Steps 1+2 collapse into a single click.

| # | Page | Action | Expected state | Camera-cut anchor |
|---|---|---|---|---|
| 1 | **Scenarios** | Click **Load preset** (the only scenario preset is `beam-degradation-001`; custom-JSON load is VS-3 future) | Alert: `Loaded beam-degradation-001: 3 beams, 1 gateway(s).` | 0:40 (UC1 walkthrough begins) |
| 2 | **Scenarios** | Set seconds field to `90` (or click the `90s` quick-pick) → click **Tick + 90s** | Alert: `t = 90s · active: snr_drop` | (still 0:40–1:10 window) |
| 3 | **Copilot** | Type `Which beam is degrading and why?` → click **Ask Copilot** | Response within ~1 s: `status=ok`, `summary` cites `orbitops_beam_snr_db{beam_id="beam-1"}=6.5 dB`, confidence ≈ 0.78, 3 ranked `recommended_actions` | 1:10 (Copilot panel reveal) |
| 4 | **Grafana** (split-screen optional) | Switch to OrbitOps Overview dashboard `/d/orbitops-overview` | All 8 panels rendering live data; "Beam SNR (dB)" panel shows the 6.5 dB drop on `beam-1` over the 60–150 s window | 1:30 (UC2 transition) |

### Post-anomaly notes

- The `snr_drop` event runs `t=60..150 s`. **Do not tick past `t=150`** during recording — SNR snaps back to 12.5 dB and the demo loses its hook.
- For UC2 footage (1:30–2:10): the Sprint-1 UI **does not** ship a custom-scenario picker (VS-3 future); only the `beam-degradation` preset is loadable from the UI. UC2's `handover-failure` content is currently demoed via direct API call (e.g. `curl -X POST .../scenario/load -d @packages/scenarios/handover-failure.json`); reload also via API. The scenario itself fires `handover_failure` on `beam-1` at **t=90..150** (60 s) plus a concurrent `doppler_spike` at t=90..120 — tick to **t=120** to land mid-window. UI then has only **Ask Copilot** (no separate "Generate Runbook" button); a runbook-shaped response comes from the same `/ask` endpoint when the question intent matches handover_failure.
- If recording stalls or the timer overshoots, click **Load preset** again — it's idempotent and resets `t` to 0.

### Failure modes to AVOID on camera

| Symptom | Root cause | Fix |
|---|---|---|
| Copilot returns `INSUFFICIENT_EVIDENCE` | Skipped Step 1 + 2 (no scenario loaded, or `t < 60`) | Re-do Steps 1–3 in order |
| Copilot returns `INSUFFICIENT_EVIDENCE` after Step 2 | Ticked past `t=150` (anomaly already ended) | Click **Load preset** to reset |
| Grafana panel count = 7 (no Beam Elevation panel) | Live ConfigMap stale post obs PR | Run `make k8s-reload-observability` (added by PR #40, VS-7). If PR #40 hasn't merged on your tree yet, the underlying recipe is: `kustomize build --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/local \| kubectl apply -f -` then `kubectl -n orbitops rollout restart deployment/grafana deployment/prometheus`. |
| `/ask` 4xx with CORS error in browser console | UI is being served from an origin that's not in the backend's CORS allowlist (controlled by `CORS_ALLOWED_ORIGINS` env var on emulator + copilot deployments — see `deploy/k8s/base/*-deployment.yaml`). NOT a `VITE_*_BASE_URL` issue — those control which API the UI calls; CORS is enforced by the API. | Either (a) access the UI at an already-allowed origin (the manifest's `CORS_ALLOWED_ORIGINS` lists the expected ones), or (b) edit `CORS_ALLOWED_ORIGINS` to add your origin and `kubectl apply` + restart the relevant deployment. |
