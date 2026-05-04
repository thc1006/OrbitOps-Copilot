/**
 * VS-13 S4 — beam coverage cone calculator (pure-function, no Cesium).
 *
 * For each `BeamView` from useMetricsPoll, computes the geometry +
 * color of a satellite-beam coverage cone anchored at the ground
 * station (apex at NYCU, opening upward toward the satellite). The
 * resulting `BeamCone` array is consumed by SatelliteView.tsx and
 * mapped 1:1 to resium <CylinderGraphics> entities (Cesium models
 * "cones" as cylinders with bottomRadius=0).
 *
 * Color comes from snr_db using the same red/yellow/green thresholds
 * as the Beams page StatusChip — ensures cross-page visual consistency.
 *
 * NOT a real link-budget calculator. The cone width vs elevation
 * mapping uses a simple slant-range proxy adequate for demo
 * visualization, NOT for ground-station scheduling. Real link math
 * (free-space path loss, antenna patterns, atmospheric attenuation)
 * lands when the emulator surfaces per-beam pointing.
 */

import type { BeamHealth, BeamView } from "../types";

export interface ConeColor {
  /** CSS hex color string (matches StatusChip / theme colors). */
  hex: string;
  /** 0..1 opacity for translucent overlap rendering. */
  alpha: number;
}

export interface ConePosition {
  lat_deg: number;
  lon_deg: number;
  alt_m: number;
}

export interface BeamCone {
  /** Source beam_id, preserved 1:1 from the input BeamView. */
  beam_id: string;
  /** Position the resium Entity uses (Cesium cylinders are centered on this). */
  position: ConePosition;
  /** Cylinder length in meters. Apex sits at position.alt - length/2. */
  lengthMeters: number;
  /** Cone apex (= 0 — apex is at the ground-station altitude, beam opens upward). */
  bottomRadiusMeters: number;
  /** Cone opening radius at the top (satellite altitude footprint proxy). */
  topRadiusMeters: number;
  /** Color derived from BeamView.health (matches Beams page StatusChip exactly). */
  color: ConeColor;
}

export interface CalculateBeamConesOptions {
  /** Cone length in meters. Default 550_000 (550 km, typical LEO). */
  maxAltitudeMeters?: number;
  /** Reference top-radius at high elevation (90°). Default 30_000 m. */
  baseTopRadiusMeters?: number;
  /** Ground-station altitude in meters AMSL. Default 0. */
  groundAltitudeMeters?: number;
}

const COLOR_CRIT = "#ff7675"; // red — matches theme.error.main + StatusChip crit
const COLOR_WARN = "#fdcb6e"; // yellow — matches theme.warning.main + StatusChip warn
const COLOR_OK = "#00b894"; // green — matches theme.success.main + StatusChip ok
const CONE_ALPHA = 0.25; // translucent so overlapping cones blend

/**
 * Map BeamHealth → ConeColor. PR #79 review: pulling color from
 * the precomputed `health` field (instead of recomputing from snr_db
 * with a different threshold) guarantees the satellite-view cones
 * match the Beams-page StatusChip exactly. The actual health
 * computation lives in src/api.ts (SNR_DEGRADED_THRESHOLD=8;
 * crit if ho>=2 OR snr<6; warn if snr<8).
 */
export function colorFromHealth(health: BeamHealth): ConeColor {
  switch (health) {
    case "crit":
      return { hex: COLOR_CRIT, alpha: CONE_ALPHA };
    case "warn":
      return { hex: COLOR_WARN, alpha: CONE_ALPHA };
    case "ok":
      return { hex: COLOR_OK, alpha: CONE_ALPHA };
  }
}

/**
 * Compute one BeamCone per BeamView. Cones are anchored at the ground
 * station (apex), pointing straight up toward zenith with a footprint
 * radius proportional to the slant range at the beam's elevation.
 */
export function calculateBeamCones(
  beams: ReadonlyArray<BeamView>,
  groundLat: number,
  groundLon: number,
  options: CalculateBeamConesOptions = {},
): BeamCone[] {
  const length = options.maxAltitudeMeters ?? 550_000;
  const baseTop = options.baseTopRadiusMeters ?? 30_000;
  const groundAlt = options.groundAltitudeMeters ?? 0;

  // Cesium cylinders are centered on `position`. To put the apex at
  // the ground station's altitude, position the cylinder centerline
  // at groundAlt + length/2.
  const centerAlt = groundAlt + length / 2;

  return beams.map((b) => {
    // Slant-range proxy: at zenith (elevation=90°) the cone footprint
    // at length is just baseTop. At low elevation the slant range is
    // length/sin(elev), so the cross-sectional footprint widens.
    //
    // PR #79 review: BeamView.elevation_deg defaults to NaN when
    // orbitops_beam_elevation_deg isn't in the scrape. Math.max(NaN,5)
    // is NaN and propagates through 1/Math.sin(NaN)=NaN, producing
    // NaN topRadius — Cesium would either reject or render garbage.
    // Number.isFinite() check first; treat non-finite as the 5° floor.
    const rawElev = Number.isFinite(b.elevation_deg) ? b.elevation_deg : 5;
    const elevRad = (Math.max(rawElev, 5) * Math.PI) / 180;
    const slantFactor = 1 / Math.sin(elevRad);
    const topRadius = baseTop * slantFactor;

    return {
      beam_id: b.beam_id,
      position: {
        lat_deg: groundLat,
        lon_deg: groundLon,
        alt_m: centerAlt,
      },
      lengthMeters: length,
      bottomRadiusMeters: 0,
      topRadiusMeters: topRadius,
      color: colorFromHealth(b.health),
    };
  });
}
