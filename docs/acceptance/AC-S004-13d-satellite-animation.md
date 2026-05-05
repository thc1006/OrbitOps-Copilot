# AC-S004-13d — Animated satellite pass + play/pause acceptance criteria

**Parent SPEC**: SPEC-S004-13d-satellite-animation
**Closes**: VS-13 S5 deferral

## Given / When / Then

### AC-S004-13d.1 — `interpolateSampleAtFraction` exposes a pure linear-interpolation surface

- **Given** the new lib `services/digital-twin-ui/src/lib/pass-animation.ts`
- **When** I call `interpolateSampleAtFraction(samples, fraction)` for a 60-sample pass
- **Then**:
  - `fraction = 0` returns `samples[0]` exactly
  - `fraction = 1` returns `samples[samples.length - 1]` exactly
  - `fraction = 0.5` returns the geometric midpoint of the two surrounding samples
  - `fraction < 0` clamps to `samples[0]`
  - `fraction > 1` clamps to `samples[last]`
  - `samples.length < 2` throws `Error("interpolateSampleAtFraction requires ≥2 samples")`
- **Verification**: `npx vitest run src/lib/pass-animation.test.ts` → 6/6 pass.

### AC-S004-13d.2 — Play button mounts on `/satellite-view`

- **Given** `<SatelliteView data={...} />` rendered with mocked resium + cesium
- **When** I `render()` and query `getByRole('button', { name: /play/i })`
- **Then** the element is in the document.
- The Pause + Reset buttons are also present.

### AC-S004-13d.3 — Clicking Play advances the satellite position

- **Given** `<SatelliteView data={null} />` rendered with `vi.useFakeTimers()` enabled
- **When** I click Play, then `vi.advanceTimersByTime(1000)`, then read the satellite Entity's `data-pass-fraction` test-only attribute
- **Then** the value is strictly greater than 0 and strictly less than 1.
- After clicking Pause and advancing timers another 1 s, the value is unchanged from the moment of pause.

### AC-S004-13d.4 — Reset returns to fraction = 0

- **Given** the page is in any non-zero playback state
- **When** I click Reset
- **Then** the satellite Entity's `data-pass-fraction` is exactly `0` and `isPlaying` flips to `false`.

### AC-S004-13d.5 — Auto-stop at fraction = 1

- **Given** Play is clicked
- **When** enough fake-timer ticks pass to drive fraction past 1.0
- **Then** the actual `data-pass-fraction` clamps at exactly `1`, `isPlaying` is `false`, and further `advanceTimersByTime` does NOT continue ticking.

### AC-S004-13d.6 — Cleanup invariants

- **Given** the page is unmounted while `isPlaying` is true
- **When** subsequent fake-timer ticks pass
- **Then** no `act(...)` / "update on unmounted component" warning is emitted in `console.error` (asserted via `vi.spyOn(console, 'error')` checking call count is 0).

### AC-S004-13d.7 — i18n contract extension

- **Given** `src/i18n/i18n.test.tsx`
- **When** I read `REQUIRED_KEYS`
- **Then** these 5 keys are present:
  - `satellite.playback.play`
  - `satellite.playback.pause`
  - `satellite.playback.reset`
  - `satellite.playback.progress`
  - `satellite.playback.speedHint`
- en.json + zh-TW.json bundles cover all 5 with non-empty values.

### AC-S004-13d.8 — zh-TW no-english-leak coverage

- **Given** `src/i18n/zh-no-english-leak.test.tsx`
- **When** the Satellite-view page is rendered under `lng=zh-TW`
- **Then** the regex `/\bPlay\b|\bPause\b|\bReset\b/` returns null via `screen.queryByText`.

### AC-S004-13d.9 — No vitest regression

- **Given** post-merge state
- **When** `npx vitest run`
- **Then** total tests ≥ 131 (was 122 + 9 new). All previously-green tests stay green.

### AC-S004-13d.10 — `./verify.sh` green

- **Given** changes are committed
- **When** I run `./verify.sh`
- **Then** all 9 blocking gates and 2 advisory gates are green.
