/**
 * VS-13 S5 (SPEC-S004-13d) — pass-animation interpolation lib.
 *
 * Pure-function counterpart to SatelliteView's animated satellite. Given
 * a precomputed PassPath (from `calculateSinPass`) and a fraction in
 * [0, 1], returns the linearly-interpolated PassSample at that fraction
 * of the pass.
 *
 * Why pure: keeps the math out of the Cesium-mocked component, so
 * tests don't need to construct JulianDates or stub
 * SampledPositionProperty. SatelliteView wraps the result in a plain
 * Cartesian3.fromDegrees(...) call — no extra cesium mock surface.
 *
 * See SPEC-S004-13d §4 for the alternatives (SampledPositionProperty,
 * CallbackPositionProperty) that were considered and rejected.
 */
import type { PassSample } from "./orbital-pass";

/**
 * Linearly interpolate the satellite position at a given fraction
 * along the pass.
 *
 * - `fraction = 0` → first sample exactly
 * - `fraction = 1` → last sample exactly
 * - `fraction < 0` → clamped to first sample
 * - `fraction > 1` → clamped to last sample
 * - intermediate fractions interpolate between the two surrounding
 *   samples on `lat_deg`, `lon_deg`, `alt_m`, and `t_seconds`.
 *
 * Throws if `samples.length < 2` (no interpolation possible).
 */
export function interpolateSampleAtFraction(
  samples: PassSample[],
  fraction: number,
): PassSample {
  if (samples.length < 2) {
    throw new Error(
      `interpolateSampleAtFraction requires ≥2 samples; got ${samples.length}`,
    );
  }

  if (fraction <= 0) return samples[0];
  if (fraction >= 1) return samples[samples.length - 1];

  // Locate the segment that contains `fraction`. With N samples the
  // segments are bounded by fractions i / (N-1) for i ∈ [0, N-1].
  const N = samples.length;
  const segmentLength = 1 / (N - 1);
  const segmentIndex = Math.floor(fraction / segmentLength);
  const segmentStartFraction = segmentIndex * segmentLength;
  // Local interpolation parameter inside the segment, in [0, 1).
  const u = (fraction - segmentStartFraction) / segmentLength;

  const a = samples[segmentIndex];
  const b = samples[segmentIndex + 1];

  return {
    t_seconds: a.t_seconds + u * (b.t_seconds - a.t_seconds),
    lon_deg: a.lon_deg + u * (b.lon_deg - a.lon_deg),
    lat_deg: a.lat_deg + u * (b.lat_deg - a.lat_deg),
    alt_m: a.alt_m + u * (b.alt_m - a.alt_m),
  };
}
