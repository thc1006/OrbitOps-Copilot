/**
 * VS-13 S4 — pure-function tests for beam-coverage-cone calculator.
 *
 * No Cesium dependency. Tests the math + color mapping that S4's
 * SatelliteView.tsx feeds into resium <CylinderGraphics> per beam.
 */
import { describe, expect, test } from "vitest";

import {
  calculateBeamCones,
  colorFromSnr,
  type ConeColor,
} from "./beam-cone";
import type { BeamView } from "../types";

const beam = (overrides: Partial<BeamView>): BeamView => ({
  beam_id: "beam-1",
  snr_db: 10,
  sinr_db: 8,
  latency_ms: 25,
  packet_loss_ratio: 0.001,
  doppler_residual_hz: 0,
  handover_state: 0,
  elevation_deg: 55,
  health: "ok",
  ...overrides,
});

describe("colorFromSnr — health-color contract", () => {
  test("snr <= 6 dB → red (crit threshold; matches StatusChip convention)", () => {
    expect(colorFromSnr(6).hex).toBe("#ff7675");
    expect(colorFromSnr(0).hex).toBe("#ff7675");
    expect(colorFromSnr(-3).hex).toBe("#ff7675");
  });

  test("6 < snr <= 12 dB → yellow (warn band)", () => {
    expect(colorFromSnr(7).hex).toBe("#fdcb6e");
    expect(colorFromSnr(12).hex).toBe("#fdcb6e");
  });

  test("snr > 12 dB → green (healthy)", () => {
    expect(colorFromSnr(13).hex).toBe("#00b894");
    expect(colorFromSnr(20).hex).toBe("#00b894");
  });

  test("returns alpha for translucent overlap rendering", () => {
    const c: ConeColor = colorFromSnr(15);
    expect(c.alpha).toBeGreaterThan(0);
    expect(c.alpha).toBeLessThanOrEqual(1);
  });
});

describe("calculateBeamCones — cone geometry", () => {
  const NYCU_LAT = 24.787;
  const NYCU_LON = 120.998;

  test("empty beams array → empty cones array", () => {
    const cones = calculateBeamCones([], NYCU_LAT, NYCU_LON);
    expect(cones).toEqual([]);
  });

  test("one cone per beam, matching beam_id", () => {
    const beams = [
      beam({ beam_id: "beam-1", snr_db: 15 }),
      beam({ beam_id: "beam-2", snr_db: 8 }),
      beam({ beam_id: "beam-3", snr_db: 4 }),
    ];
    const cones = calculateBeamCones(beams, NYCU_LAT, NYCU_LON);
    expect(cones).toHaveLength(3);
    expect(cones.map((c) => c.beam_id)).toEqual([
      "beam-1",
      "beam-2",
      "beam-3",
    ]);
  });

  test("cone color tracks snr (15 → green, 8 → yellow, 4 → red)", () => {
    const beams = [
      beam({ beam_id: "beam-1", snr_db: 15 }),
      beam({ beam_id: "beam-2", snr_db: 8 }),
      beam({ beam_id: "beam-3", snr_db: 4 }),
    ];
    const cones = calculateBeamCones(beams, NYCU_LAT, NYCU_LON);
    expect(cones[0].color.hex).toBe("#00b894"); // green
    expect(cones[1].color.hex).toBe("#fdcb6e"); // yellow
    expect(cones[2].color.hex).toBe("#ff7675"); // red
  });

  test("cone position is on the ground-station vertical (lat/lon = NYCU, alt = length/2)", () => {
    const cones = calculateBeamCones([beam({})], NYCU_LAT, NYCU_LON);
    expect(cones[0].position.lat_deg).toBeCloseTo(NYCU_LAT, 9);
    expect(cones[0].position.lon_deg).toBeCloseTo(NYCU_LON, 9);
    // CylinderGraphics's position is centered on the cylinder, so the
    // altitude must be half the length so the apex is at ground level.
    expect(cones[0].position.alt_m).toBeCloseTo(cones[0].lengthMeters / 2, 5);
  });

  test("default cone length = 550 km (typical LEO altitude)", () => {
    const cones = calculateBeamCones([beam({})], NYCU_LAT, NYCU_LON);
    expect(cones[0].lengthMeters).toBe(550_000);
  });

  test("cone bottomRadius = 0 (apex at ground), topRadius > 0 (opening at top)", () => {
    const cones = calculateBeamCones([beam({})], NYCU_LAT, NYCU_LON);
    expect(cones[0].bottomRadiusMeters).toBe(0);
    expect(cones[0].topRadiusMeters).toBeGreaterThan(0);
  });

  test("topRadius scales with elevation_deg — lower elevation = wider cone footprint", () => {
    const high = calculateBeamCones([beam({ elevation_deg: 80 })], NYCU_LAT, NYCU_LON);
    const low = calculateBeamCones([beam({ elevation_deg: 20 })], NYCU_LAT, NYCU_LON);
    // Lower-elevation beams have a longer slant range → larger footprint
    // at altitude. Test both produce sensible cones, with low-elevation
    // strictly wider than high-elevation.
    expect(low[0].topRadiusMeters).toBeGreaterThan(high[0].topRadiusMeters);
  });

  test("custom maxAltitudeMeters override", () => {
    const cones = calculateBeamCones([beam({})], NYCU_LAT, NYCU_LON, {
      maxAltitudeMeters: 408_000, // ISS
    });
    expect(cones[0].lengthMeters).toBe(408_000);
    expect(cones[0].position.alt_m).toBeCloseTo(204_000, 5);
  });
});
