/**
 * VS-13 S3 — orbital pass calculator (pure-function, no Cesium types).
 *
 * Generates a simplified great-circle satellite-pass trajectory over a
 * ground station: the satellite enters from one horizon, climbs along
 * a sine-shaped altitude profile to a peak at mid-pass, and exits at
 * the opposite horizon ~10 minutes later (typical LEO overhead pass).
 *
 * NOT a real orbit propagator — no SGP4 / TLE input, no inclination
 * modeling, no perturbations. The output is "demo-grade", suitable
 * for visualization but not for ground-station scheduling. Real
 * propagation lands in a future Sprint when the emulator surfaces TLEs.
 *
 * Pure: tests hit this without mocking Cesium. Cesium-aware code in
 * SatelliteView.tsx wraps the samples in SampledPositionProperty.
 */

export interface PassSample {
  /** Seconds from pass start. 0 = horizon entry; durationSeconds = horizon exit. */
  t_seconds: number;
  /** Subsatellite-point longitude in degrees. */
  lon_deg: number;
  /** Subsatellite-point latitude in degrees. */
  lat_deg: number;
  /** Altitude in meters above ellipsoid. */
  alt_m: number;
}

export interface PassPath {
  /** Total pass duration in seconds. Default 600 s (10 min) for typical LEO. */
  durationSeconds: number;
  /** Time-ordered samples (t_seconds is monotonically increasing). */
  samples: PassSample[];
}

export interface CalculatePassOptions {
  /** Pass duration in seconds. Default 600 (10 min). */
  durationSeconds?: number;
  /** Number of position samples. Default 60 (one per 10 s for a 10-min pass). */
  sampleCount?: number;
  /** Peak altitude in meters at mid-pass. Default 550_000 (550 km — typical LEO). */
  maxAltitudeMeters?: number;
  /** Bearing of pass in degrees from north (0 = N→S, 90 = W→E). Default 90 (west-east). */
  bearingDeg?: number;
  /** Half-arc in degrees from peak to horizon. Default 8° (~ horizon-to-horizon LEO ground track). */
  arcHalfAngleDeg?: number;
}

/**
 * Generate a sine-shaped great-circle pass over (groundLat, groundLon).
 *
 * The trajectory:
 *   - Enters from one side at t=0 (altitude rising from 0)
 *   - Peaks at t=duration/2 (altitude = maxAltitudeMeters)
 *   - Exits the other side at t=duration (altitude falling back to 0)
 *   - Lat/lon traced by linear interpolation along a great-circle bearing
 *     centered on the ground station
 *
 * For a typical demo (default options), this produces 60 samples over
 * 600 s (10 min), peaking at 550 km altitude — close to ISS-like.
 */
export function calculateSinPass(
  groundLat: number,
  groundLon: number,
  options: CalculatePassOptions = {},
): PassPath {
  const duration = options.durationSeconds ?? 600;
  const count = options.sampleCount ?? 60;
  const maxAlt = options.maxAltitudeMeters ?? 550_000;
  const bearing = options.bearingDeg ?? 90;
  const halfArc = options.arcHalfAngleDeg ?? 8;

  if (duration <= 0) {
    throw new Error(`durationSeconds must be > 0; got ${duration}`);
  }
  if (count < 2) {
    throw new Error(`sampleCount must be >= 2; got ${count}`);
  }

  const samples: PassSample[] = [];
  // Bearing in radians. Negative latitude offset means "south of ground" etc.
  const bearingRad = (bearing * Math.PI) / 180;
  const cosLat = Math.cos((groundLat * Math.PI) / 180);

  for (let i = 0; i < count; i++) {
    // Normalized position along the pass: 0 at start, 0.5 at peak, 1 at end.
    const u = i / (count - 1);

    // Sine-shaped altitude: 0 at endpoints, max at midpoint.
    // sin(πu) → 0..1..0 across u ∈ [0, 1].
    const altFactor = Math.sin(Math.PI * u);
    const alt_m = maxAlt * altFactor;

    // Linear arc parameter: -halfArc at start, +halfArc at end.
    const arcOffsetDeg = -halfArc + 2 * halfArc * u;

    // Project arc offset along the bearing direction.
    // (Small-angle approximation — not exact great-circle math, but
    // adequate for demo-scale visualization at LEO timescales.)
    const dLat = arcOffsetDeg * Math.cos(bearingRad);
    const dLon = (arcOffsetDeg * Math.sin(bearingRad)) / cosLat;

    samples.push({
      t_seconds: u * duration,
      lat_deg: groundLat + dLat,
      lon_deg: groundLon + dLon,
      alt_m,
    });
  }

  return { durationSeconds: duration, samples };
}
