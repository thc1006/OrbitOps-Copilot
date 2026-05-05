# SPEC-S004-13d — Animated satellite pass + play/pause control

**Parent**: SPEC-004 (digital-twin-ui), VS-13
**Status**: Draft → in progress (2026-05-05)
**Closes**: VS-13 S5 deferral noted in `services/digital-twin-ui/src/pages/SatelliteView.tsx:206-210` and `sprint3_state_2026-05-05.md`
**Sibling work**: PR #77 (S2 skeleton), PR #78 (S3 pass polyline), PR #79 (S4 beam cones)

## 1. Goal

Convert the static satellite peak Entity into a time-interpolated animation that traverses the precomputed great-circle pass over the full pass duration, with a play/pause/reset UI control. The user clicks Play, the satellite moves smoothly from horizon entry to peak to horizon exit over a wall-clock duration set by a playback speed multiplier; clicks Pause and it freezes at the current sample.

## 2. Non-goals

- Real SGP4/TLE propagation. The pass remains the demo-grade `calculateSinPass` output.
- Coupling the satellite position to scenario time / `t_seconds` from `/metrics`. The pass clock is independent of the scenario clock; this is a visualization-only animation.
- Time scrubbing via slider. Play/Pause/Reset is the v1 surface; scrubbing is a follow-up if demand arises.
- Cesium-native clock-driven animation (`SampledPositionProperty` + viewer `clockViewModel.shouldAnimate`). The viewer already runs with `animation={false} timeline={false}` — keeping Cesium's clock dormant makes the page deterministic for tests. We achieve the same visual effect with a React-state-driven position prop on the same `<Entity>`.

  **Alternatives considered**:
  1. `SampledPositionProperty(samples) + JulianDate` — Cesium-native interpolation surface ([ref](https://cesium.com/learn/cesiumjs/ref-doc/SampledPositionProperty.html)). Rejected: requires `JulianDate.addSeconds(epoch, t)` per tick + `clockViewModel.currentTime` plumbing; mock surface for `vi.mock('cesium', …)` grows substantially.
  2. `CallbackPositionProperty(cb, isConstant=false)` — also native ([ref](https://cesium.com/learn/cesiumjs/ref-doc/CallbackPositionProperty.html)). Rejected: smaller mock-surface increase than (1) but still adds a class to the cesium mock. The inline-Cartesian3 path reuses the existing mock 100%.
  3. **Inline `Cartesian3.fromDegrees(currentSample.lon, currentSample.lat, currentSample.alt)` per render** — chosen. Component re-renders 20× per second (50 ms `setInterval`), each render allocates a fresh Cartesian3 (~12000 allocs over a 600 s pass — bounded, OK for demo scale). Mock surface = zero new mocks. Test-friendly. The Resium + Jest community thread (linked below) shows ES-module mocking is the recurring failure mode; the smaller our cesium import surface, the more robust the test setup.
- Tracking camera (auto-follow satellite). v1 leaves the camera under user control.

## 3. Inputs

- `services/digital-twin-ui/src/lib/orbital-pass.ts` — `calculateSinPass()` already produces 60 samples × 600 s. Re-used as-is.
- `services/digital-twin-ui/src/pages/SatelliteView.tsx` — currently picks `samples[Math.floor(samples.length / 2)]` for static peak placement.

## 4. Outputs

- New pure-function lib `services/digital-twin-ui/src/lib/pass-animation.ts`:
  - `interpolateSampleAtFraction(samples: PassSample[], fraction: number): PassSample` — linear interpolation between the two surrounding samples for `fraction ∈ [0, 1]`. Clamped at endpoints. Pure; no Cesium types; fully testable.
- Component changes in `SatelliteView.tsx`:
  - New `useState`s: `passFraction: number` (0..1) and `isPlaying: boolean`.
  - New `useEffect` driving the playback: when `isPlaying`, schedule a `setInterval` that advances `passFraction` by `(tickMs / (durationSeconds * 1000) / playbackSpeed)`; when `false`, clear the interval. On unmount, clear interval (cleanup).
  - Replace the static `SATELLITE_POSITION` constant with a derived value computed from `interpolateSampleAtFraction(DEMO_PASS.samples, passFraction)`.
  - New `<PlaybackControls>` overline with three buttons: ▶ Play / ⏸ Pause / ↺ Reset, plus a read-only progress indicator (`t = {currentSampleSeconds}s / {durationSeconds}s`).
  - i18n keys for the new UI strings (per AC-S004-5b chain #3 cross-page alignment): `satellite.playback.play`, `satellite.playback.pause`, `satellite.playback.reset`, `satellite.playback.progress`.
- Tests:
  - `pass-animation.test.ts` — pure-function suite (≥6 cases: endpoints, midpoint, interpolation accuracy, clamp behavior, single-sample edge case rejected).
  - `SatelliteView.test.tsx` — extends existing suite with 3 cases: (1) Play button mounts; (2) clicking Play triggers `passFraction` advance via fake timers; (3) clicking Reset returns to fraction=0.

## 5. Interfaces

```ts
// pass-animation.ts (pure)
export function interpolateSampleAtFraction(
  samples: PassSample[],
  fraction: number,   // 0..1; clamped if outside
): PassSample;
```

`fraction = 0` returns `samples[0]`; `fraction = 1` returns `samples[samples.length - 1]`; intermediate fractions linearly interpolate `lat_deg`, `lon_deg`, `alt_m`, `t_seconds` between the two surrounding samples.

```tsx
// SatelliteView.tsx — local state shape
const [passFraction, setPassFraction] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const playbackSpeed = 30;            // 30× wall-clock; 600 s pass plays in 20 s
const tickMs = 50;                   // 20 fps animation
```

i18n keys (added to en.json + zh-TW.json):

```
satellite.playback.play       "Play"            / "播放"
satellite.playback.pause      "Pause"           / "暫停"
satellite.playback.reset      "Reset"           / "重置"
satellite.playback.progress   "t = {{t}}s / {{duration}}s"  / "t = {{t}}s / {{duration}}s"
satellite.playback.speedHint  "(playback speed: {{speed}}×)" / "(播放速度:{{speed}}×)"
```

## 6. Test strategy (TDD)

- **Red commit** (`red(SPEC-S004-13d):`):
  1. New `pass-animation.test.ts` with 6 failing cases — file does not exist yet, tests fail at import.
  2. Extend `SatelliteView.test.tsx` with 3 failing cases — UI elements (`getByRole('button', { name: /play/i })`) do not exist.
  3. Extend i18n `REQUIRED_KEYS` with the 5 new `satellite.playback.*` keys — bundles fail i18n contract.
- **Green commit** (`green(SPEC-S004-13d):`):
  1. Implement `pass-animation.ts` — pure function pass-animation tests green.
  2. Wire SatelliteView state + buttons + interval; component tests green.
  3. Add bundle entries; i18n contract green.
  4. zh-no-english-leak smoke test still green (any new `t()` call wins; any miss leaks "Play"/"Pause"/"Reset" and gets caught).

### Vitest fake-timer hygiene (informed by 2026 testing-best-practice research)

- `vi.useFakeTimers()` in `beforeEach`; `vi.useRealTimers()` in `afterEach` — prevents cross-file leak (Vitest fake timers are global; one test file installing them and not restoring breaks downstream files).
- All `vi.advanceTimersByTime(N)` calls wrap in `act(() => …)` — silences React 19's "update outside act" warning when the interval callback flushes a `setState` mid-tick.
- Prefer `vi.advanceTimersByTimeAsync(N)` over the sync variant when the test also `await`s a `waitFor(...)` — sync variant deadlocks because `waitFor` polls but fake timers don't auto-advance during the await.
- The vitest fake-timer config opts-in `setInterval` / `clearInterval` / `setTimeout` / `clearTimeout` (default `toFake` set covers these). We do NOT fake `requestAnimationFrame` since `setInterval` is the only async surface we use.

## 7. Acceptance criteria

See `docs/acceptance/AC-S004-13d-satellite-animation.md`. Summary:

1. `pass-animation.test.ts` — 6/6 pass; pure function exposes interpolation surface defined in §5.
2. `SatelliteView.test.tsx` — 3 new cases pass: Play button rendered; clicking Play (with fake timers + advance) updates a discriminable position-bearing data attribute; clicking Reset returns to fraction=0.
3. `i18n.test.tsx` — `REQUIRED_KEYS` extended with the 5 `satellite.playback.*` keys; en + zh-TW bundles cover them.
4. `zh-no-english-leak.test.tsx` — extended with regex for `\bPlay\b|\bPause\b|\bReset\b` on `/satellite-view`; passes under `lng=zh-TW`.
5. `npx vitest run` — total ≥ 122 + 9 = 131 (no regression; net +9 cases).
6. `./verify.sh` — 9 blocking + 2 advisory all green.
7. Manual smoke: navigate `/satellite-view`, click Play, satellite visibly traverses the polyline; Pause freezes; Reset returns to start.

## 8. Constraints

- **Anti-pattern chain accountability** (carry-over):
  - **#1 grep-verify**: every new key derived from a grep'd source string.
  - **#2 POST-WRITE verify**: re-grep after each Edit.
  - **#3 cross-page semantic alignment**: Play/Pause/Reset are local to SatelliteView page; no shared concept with other pages, so per-page `satellite.playback.*` namespace is correct (no `nav.*`-style sharing needed).
- **Cleanup invariants**: the `setInterval` returned by the playback `useEffect` MUST be cleared on:
  (a) component unmount,
  (b) `isPlaying` flipping to `false`,
  (c) re-renders that change the dependency array.
  Failure to clear leaks timers between tests and corrupts `vi.useFakeTimers` state.
- **Determinism for tests**: `tickMs` and `playbackSpeed` are module-level constants (or accept `useReducedMotion`-style override) so tests can advance them deterministically with `vi.advanceTimersByTime`.

- **Why `setInterval` and not `requestAnimationFrame`**:
  - `setInterval(50ms)` decouples animation rate from display refresh (60 Hz / 120 Hz / variable). 20 fps is plenty for a satellite that traverses 60 polyline points; pegging to display refresh would either over-tick (waste re-renders) or require our own throttle.
  - Vitest fake timers handle `setInterval` directly; `requestAnimationFrame` requires explicit `toFake: ['...', 'requestAnimationFrame']` opt-in and is slightly more failure-prone in test setups (per the 2026 vitest fake-timer best-practice research).
  - The visual effect is identical at the demo scale.

## 9. Open questions

- Q1 Should playback loop when fraction reaches 1, or stop and require Reset? → **Answer: stop + auto-set isPlaying=false at fraction=1** (predictable demo behavior; loop would be confusing for first-time viewer).
- Q2 Persist playback state across page navigation? → **No** — local-only state. Returning to the page resets to fraction=0 with isPlaying=false.

## 10. Demo relevance

Closes the VS-13 closeout deferral. The demo presenter clicks Play during the satellite-pass section and the audience sees actual motion instead of a static dot — the single biggest visual upgrade since adding the polyline.
