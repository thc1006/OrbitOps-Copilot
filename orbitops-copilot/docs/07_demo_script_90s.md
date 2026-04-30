# 07 — 90-Second Demo Script

> 純英文字幕；無旁白配音也可（screen capture + slide overlay）。

| Time | Visual | On-screen text |
|---|---|---|
| 0:00–0:08 | Title card on dark background | OrbitOps Copilot — operations twin for B5G LEO ground stations |
| 0:08–0:18 | Mermaid arch diagram fade-in | scenario → emulator → Prometheus → copilot → UI |
| 0:18–0:35 | Grafana dashboard with 3 beams | Beam-1, Beam-2, Beam-3 SNR live. Anomaly injects at t=60s. |
| 0:35–0:55 | UI Copilot panel — user types question | "Which beam is degrading and why?" → summary + evidence: orbitops_beam_snr_db{beam_id="beam-1"}=6.5 dB (v2 metric name; AC-001 threshold 8 dB) |
| 0:55–1:15 | UC2 — handover failure + 5-step runbook | What happened? Why? Action. Risk. Next window. |
| 1:15–1:30 | Roadmap card | MVP today. AODT- and Sionna-RT-ready tomorrow. |

Total: 90 seconds.

## Recording checklist

- [ ] OS toolbar hidden, browser in fullscreen, no other tabs visible
- [ ] Hostname / username invisible (override prompt to `orbitops$`)
- [ ] No team / school / Logo in UI footer
- [ ] Run `exiftool -all= demo-90s.mp4` after export
