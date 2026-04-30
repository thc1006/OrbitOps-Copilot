# 08 — 3-Minute Demo Script (English subtitled)

| Time | Visual | Subtitle |
|---|---|---|
| 0:00–0:20 | Title + map of Taiwan with LEO satellite trajectory | "Taiwan's B5G LEO program will fly its first Ka-band satellite around 2027. Payload partners are public — but the ground-station operations toolchain is not." |
| 0:20–0:40 | Cloud icon + Kubernetes badge | "OrbitOps Copilot is a cloud-native operations digital twin: Kubernetes (kind/k3d), Prometheus, Grafana, FastAPI, React, CesiumJS — and an evidence-grounded LLM copilot." |
| 0:40–1:10 | UC1 walkthrough on screen | "We load `beam-degradation.json`. The emulator emits SNR, SINR, latency, packet loss, Doppler residual, elevation, handover state. We ask: 'which beam is degrading and why?'" |
| 1:10–1:30 | Copilot panel showing evidence JSON | "The copilot replies, citing orbitops_snr_db{beam_id='beam-1'}=4.2 dB, elevation=12°. Every answer carries an evidence block — no hallucinations allowed." |
| 1:30–1:50 | UC2 — handover failure + pod health drop | "Now a handover failure plus a gateway pod going unhealthy. We click Generate Runbook." |
| 1:50–2:10 | 5-step runbook in collapsible UI | "Five steps: what, why, action, risk, next observation window. Backed by the same evidence pipeline." |
| 2:10–2:30 | Mermaid arch + boundary callouts | "The architecture is honest about its boundaries: simulation today, real ray-traced channels tomorrow, real RAN stack the day after." |
| 2:30–2:50 | Roadmap timeline | "3GPP Rel-19 NTN frozen December 2025. Rel-20 freezes September 2026. NVIDIA Aerial open-sourced under Apache 2.0. Sionna RT v2.0.1. We're on the standards path." |
| 2:50–3:00 | Closing card | "OrbitOps Copilot. Operations twin for the ground segment that does not exist yet." |

## Production notes

- All on-screen text in English; no team / school / personal identifiers.
- After export: `exiftool -all= demo-3min.mp4`.
- If voiceover used, neutralize accent / use TTS to avoid identifiability.
