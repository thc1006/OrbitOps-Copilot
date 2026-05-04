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

import type { BeamView } from "../types";

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
  /** Cylinder length in meters. Apex sits at position.alt - length/2 (ground). */
  lengthMeters: number;
  /** Cone apex (= 0 — apex is at ground level, beam opens upward). */
  bottomRadiusMeters: number;
  /** Cone opening radius at the top (satellite altitude footprint proxy). */
  topRadiusMeters: number;
  /** Color derived from BeamView.snr_db (matches Beams page convention). */
  color: ConeColor;
}

export interface CalculateBeamConesOptions {
  /** Cone length in meters. Default 550_000 (550 km, typical LEO). */
  maxAltitudeMeters?: number;
  /** Reference top-radius at high elevation (90°). Default 30_000 m. */
  baseTopRadiusMeters?: number;
}

const COLOR_CRIT = "#ff7675"; // red — matches theme.error.main
const COLOR_WARN = "#fdcb6e"; // yellow — matches theme.warning.main
const COLOR_OK = "#00b894"; // green — matches theme.success.main
const CONE_ALPHA = 0.25; // translucent so overlapping cones blend

/**
 * Map snr_db to a render color. Thresholds match the Beams page
 * StatusChip: ≤6 dB crit, 6-12 dB warn, >12 dB ok.
 */
export function colorFromSnr(snrDb: number): ConeColor {
  if (snrDb <= 6) return { hex: COLOR_CRIT, alpha: CONE_ALPHA };
  if (snrDb <= 12) return { hex: COLOR_WARN, alpha: CONE_ALPHA };
  return { hex: COLOR_OK, alpha: CONE_ALPHA };
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

  // Cesium cylinders are centered on `position`. To put the apex at
  // ground level, position the cylinder centerline at altitude length/2.
  const centerAlt = length / 2;

  return beams.map((b) => {
    // Slant-range proxy: at zenith (elevation=90°) the cone footprint
    // at length is just baseTop. At low elevation the slant range is
    // length/sin(elev), so the cross-sectional footprint widens.
    // Clamp elevation to a small floor so a 0° beam doesn't produce
    // an infinite radius.
    const elevRad = (Math.max(b.elevation_deg, 5) * Math.PI) / 180;
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
      color: colorFromSnr(b.snr_db),
    };
  });
}
