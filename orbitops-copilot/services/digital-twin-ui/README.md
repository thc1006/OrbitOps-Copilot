# digital-twin-ui

Sprint 1 minimum-viable web UI for the OrbitOps Copilot demo. Three panels:

1. **Digital Twin View** — pure SVG: ground station, satellite arc, 3 colour-coded beams.
2. **Metrics Panel** — per-beam SNR / SINR / latency / packet loss / Doppler residual / handover state, with health colour rings.
3. **Copilot Panel** — question input → grounded answer (summary, likely cause, recommended actions, evidence, unknowns, confidence). Renders REFUSED / INSUFFICIENT_EVIDENCE / ERROR / ok states distinctly.

## Why SVG, not CesiumJS

SPEC-004 §3 reserves CesiumJS satellite-pass animation for VS-13 (Sprint 3). For Sprint 1 demo stability, the UI uses pure SVG: zero GPU dependency, jsdom-friendly tests, < 1 KB runtime cost. The visual is a schematic, **not** a true orbit.

## Stack (Sprint 1 — today's stable npm versions)

- React 18.3, Vite 5.4, TypeScript 5.6, Tailwind 3.4
- Vitest 2.1 + @testing-library/react 16 + jsdom 25

`docs/09_installation_research.md` targets future versions (React 19 / Vite 8 / TS 6 / Tailwind 4 / CesiumJS 1.140); **those upgrades land in VS-13** alongside the satellite-pass animation. Pinning future versions today would break `npm install`.

## Run

```bash
cd services/digital-twin-ui
npm install                           # one-time
npm run dev                           # http://127.0.0.1:5173
```

UI route: `/` (single-page; no router for Sprint 1).

To talk to a running copilot-api, set `VITE_API_BASE_URL`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001 npm run dev
```

If `VITE_API_BASE_URL` is unset (default), the Copilot Panel returns a hard-coded mock response — useful for offline demo.

## Test

```bash
npm test         # vitest run, 11 tests
npx tsc --noEmit
npx vite build
```

## Screenshot / record

- **Screenshot**: any browser dev-tools "capture full size" works. Recommend setting viewport to 1440×900 for sprint-review screenshots.
- **Record**: macOS ⌘⇧5 / Linux `kazam` / Windows OBS. The demo flow is: load page → see anomaly banner → see beam-1 critical (red) → click "Ask" → grounded answer fills Copilot Panel.
- **Anonymity** before submission: `exiftool -all= screenshot.png` and crop OS chrome.
