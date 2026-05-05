/**
 * SPEC-S004-13d — pass-animation pure-function lib (red commit).
 *
 * The lib does not exist yet; all 6 cases fail at import. Green commit
 * lands the implementation in `pass-animation.ts`.
 *
 * Why pure-function: keeps the satellite-position math out of the
 * Cesium-mocked component, so tests don't need to construct JulianDates
 * or stub SampledPositionProperty. See SPEC-S004-13d §4 alternatives.
 */
import { describe, expect, test } from "vitest";

import type { PassSample } from "./orbital-pass";
import { interpolateSampleAtFraction } from "./pass-animation";

const SIX_SAMPLES: PassSample[] = [
  { t_seconds:   0, lon_deg: 120, lat_deg: 24.5, alt_m:      0 },
  { t_seconds: 120, lon_deg: 121, lat_deg: 24.7, alt_m: 200_000 },
  { t_seconds: 240, lon_deg: 122, lat_deg: 24.9, alt_m: 450_000 },
  { t_seconds: 360, lon_deg: 123, lat_deg: 25.1, alt_m: 450_000 },
  { t_seconds: 480, lon_deg: 124, lat_deg: 25.3, alt_m: 200_000 },
  { t_seconds: 600, lon_deg: 125, lat_deg: 25.5, alt_m:      0 },
];

describe("interpolateSampleAtFraction", () => {
  test("fraction = 0 returns the first sample exactly", () => {
    const r = interpolateSampleAtFraction(SIX_SAMPLES, 0);
    expect(r).toEqual(SIX_SAMPLES[0]);
  });

  test("fraction = 1 returns the last sample exactly", () => {
    const r = interpolateSampleAtFraction(SIX_SAMPLES, 1);
    expect(r).toEqual(SIX_SAMPLES[SIX_SAMPLES.length - 1]);
  });

  test("fraction = 0.5 (between sample 2 and 3) is the geometric midpoint", () => {
    // 6 samples → segments at fractions 0/0.2/0.4/0.6/0.8/1.0
    // fraction=0.5 falls between samples[2] (frac=0.4) and samples[3] (frac=0.6).
    // Local t = (0.5 - 0.4) / (0.6 - 0.4) = 0.5 → midpoint between samples[2,3].
    const a = SIX_SAMPLES[2];
    const b = SIX_SAMPLES[3];
    const r = interpolateSampleAtFraction(SIX_SAMPLES, 0.5);
    expect(r.lon_deg).toBeCloseTo((a.lon_deg + b.lon_deg) / 2, 6);
    expect(r.lat_deg).toBeCloseTo((a.lat_deg + b.lat_deg) / 2, 6);
    expect(r.alt_m).toBeCloseTo((a.alt_m + b.alt_m) / 2, 6);
    expect(r.t_seconds).toBeCloseTo((a.t_seconds + b.t_seconds) / 2, 6);
  });

  test("fraction < 0 clamps to first sample", () => {
    const r = interpolateSampleAtFraction(SIX_SAMPLES, -0.5);
    expect(r).toEqual(SIX_SAMPLES[0]);
  });

  test("fraction > 1 clamps to last sample", () => {
    const r = interpolateSampleAtFraction(SIX_SAMPLES, 99);
    expect(r).toEqual(SIX_SAMPLES[SIX_SAMPLES.length - 1]);
  });

  test("samples.length < 2 throws", () => {
    expect(() => interpolateSampleAtFraction([], 0.5)).toThrow(
      /requires.*2.*sample/i,
    );
    expect(() =>
      interpolateSampleAtFraction([SIX_SAMPLES[0]], 0.5),
    ).toThrow(/requires.*2.*sample/i);
  });
});
