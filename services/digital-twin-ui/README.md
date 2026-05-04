# digital-twin-ui

OrbitOps Copilot's web UI — Material Design / k8s-Dashboard aesthetic, talking to `copilot-api` and `ntn-metrics-emulator` via REST.

## What ships

Multi-route SPA with these surfaces (all wired against the live emulator's `/metrics` 5 s scrape):

| Route | What |
|---|---|
| `/` (Overview) | Scenario clock + active anomaly banner + headline cards |
| `/scenarios` | Load one of the 3 packaged scenarios + "Ready for Copilot" affordance |
| `/beams` | Per-beam SNR / SINR / latency / packet loss / Doppler residual / elevation / handover-state table + 3 stacked Recharts time-series panels (SNR / Latency / Doppler) |
| `/gateways` | Gateway availability gauges |
| `/anomalies` | Active anomalies + 5 inject buttons (`/anomaly/inject` API; runtime override) |
| `/copilot` | Question input → grounded `/ask` answer; renders summary / likely cause / recommended actions / evidence (citations + inline sparklines) / unknowns / confidence; REFUSED / INSUFFICIENT_EVIDENCE / ERROR / ok states distinct |

i18n: EN + Traditional Chinese (zh-TW); locale auto-detected from `navigator.language` (per AC-S004-5; PR #68). 15 keys cover Anomalies + Beams interactive surfaces; other pages still hardcoded English (tracked in issue #72 / I-17).

## Stack (VS-13 baseline — bumped 2026-05-04 in PR #74)

| Layer | Version |
|---|---|
| React | 19.2 |
| Vite | 8.0 (rolldown bundler — full build ~1.5 s) |
| TypeScript | 6.0 (strict module resolution) |
| Vitest | 4.1 + @testing-library/react 16.3 + jsdom 29 |
| react-router-dom | 7.14 (data router default) |
| Recharts | 3.8 |
| MUI | 6.x |
| i18next + react-i18next | 25 / 16 |
| **Node runtime floor** | **22.13.0** (enforced via `.npmrc engine-strict=true` + CI `actions/setup-node@v4`) |

CesiumJS 1.141 satellite-pass viz lands in VS-13 S2 (separate PR after S1.1).

## Run

```bash
cd services/digital-twin-ui
npm install                           # one-time; will FAIL on Node < 22.13 (engine-strict=true)
npm run dev                           # http://127.0.0.1:5173

# Override the default API endpoints (see src/api.ts for the full list):
VITE_COPILOT_BASE_URL=http://127.0.0.1:8001 \
VITE_EMULATOR_BASE_URL=http://127.0.0.1:8000 \
  npm run dev

# Defaults (when unset): http://${hostname}:30081 (copilot) / :30080 (emulator)
# / :30090 (prometheus) / :30030 (grafana). These match `make k8s-up`'s
# NodePort layout. There is NO offline mock fallback — if the copilot
# endpoint is unreachable, askCopilot() returns an ERROR-shaped response
# and the UI surfaces it as "ERROR" state. Run the emulator + copilot
# locally (or in K8s) before opening /copilot.
```

## Test

```bash
npm test         # vitest run — currently 88 passing across 12 files
                 # (run `npm test -- --reporter=verbose` for per-file counts)
npx tsc --noEmit # strict TS6 typecheck
npm run build    # tsc --noEmit && vite build (rolldown; ~1.5 s)
```

Test count is intentionally not broken down here — it changes per PR; the
above command surfaces the live numbers.

## Screenshot / record

- **Screenshot**: browser dev-tools "capture full size" (Chrome / Firefox).
  Recommend 1440×900 viewport for review screenshots. No bundled wrapper
  script — use the dev-tools UI directly.
- **Record**: macOS ⌘⇧5 / Linux `kazam` / Windows OBS. Demo flow: scenario
  load → anomaly banner → beam-1 critical (red) → click "Ask" → grounded
  answer with metric sparkline.
- **RunSpace submission**: per CLAUDE.md §7, scrub OS chrome + tab bar +
  IDE personal info; `exiftool -all= screenshot.png` strips metadata. Repo
  itself stays non-anonymous (CLAUDE.md §2.1, 2026-05-01 policy reversal);
  only the submission archive needs scrubbing.
