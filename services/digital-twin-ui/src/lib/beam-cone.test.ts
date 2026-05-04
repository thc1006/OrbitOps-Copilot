/**
 * VS-13 S4 — pure-function tests for beam-coverage-cone calculator.
 *
 * No Cesium dependency. Tests the math + color mapping that S4's
 * SatelliteView.tsx feeds into resium <CylinderGraphics> per beam.
 */
import { describe, expect, test } from "vitest";

import {
  calculateBeamCones,
  colorFromHealth,
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

describe("colorFromHealth — matches Beams-page StatusChip exactly (PR #79 review fix)", () => {
  test("'crit' → red", () => {
    expect(colorFromHealth("crit").hex).toBe("#ff7675");
  });

  test("'warn' → yellow", () => {
    expect(colorFromHealth("warn").hex).toBe("#fdcb6e");
  });

  test("'ok' → green", () => {
    expect(colorFromHealth("ok").hex).toBe("#00b894");
  });

  test("returns alpha for translucent overlap rendering", () => {
    const c: ConeColor = colorFromHealth("ok");
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

  test("cone color tracks BeamView.health (ok → green, warn → yellow, crit → red)", () => {
    const beams = [
      beam({ beam_id: "beam-1", health: "ok" }),
      beam({ beam_id: "beam-2", health: "warn" }),
      beam({ beam_id: "beam-3", health: "crit" }),
    ];
    const cones = calculateBeamCones(beams, NYCU_LAT, NYCU_LON);
    expect(cones[0].color.hex).toBe("#00b894"); // green
    expect(cones[1].color.hex).toBe("#fdcb6e"); // yellow
    expect(cones[2].color.hex).toBe("#ff7675"); // red
  });

  test("cone position is on the ground-station vertical (lat/lon = NYCU, alt = length/2 + groundAlt)", () => {
    const cones = calculateBeamCones([beam({})], NYCU_LAT, NYCU_LON);
    expect(cones[0].position.lat_deg).toBeCloseTo(NYCU_LAT, 9);
    expect(cones[0].position.lon_deg).toBeCloseTo(NYCU_LON, 9);
    // CylinderGraphics's position is centered on the cylinder; default
    // groundAltitudeMeters=0 → apex at sea level.
    expect(cones[0].position.alt_m).toBeCloseTo(cones[0].lengthMeters / 2, 5);
  });

  test("groundAltitudeMeters override shifts the apex (PR #79 review fix)", () => {
    // SatelliteView passes NYCU_ALT_M=30; without this option the cone
    // apex would sit ~30 m below the ground-station pin.
    const cones = calculateBeamCones([beam({})], NYCU_LAT, NYCU_LON, {
      groundAltitudeMeters: 30,
    });
    expect(cones[0].position.alt_m).toBeCloseTo(
      30 + cones[0].lengthMeters / 2,
      5,
    );
  });

  test("non-finite elevation_deg is treated as the 5° floor (PR #79 review fix)", () => {
    // BeamView.elevation_deg defaults to NaN when
    // orbitops_beam_elevation_deg is missing from the scrape (api.ts).
    // Math.max(NaN, 5) === NaN and propagates through 1/Math.sin → NaN
    // topRadius. Number.isFinite check ensures we degrade to the 5°
    // floor instead of returning NaN.
    const cones = calculateBeamCones(
      [beam({ elevation_deg: NaN }), beam({ beam_id: "b2", elevation_deg: 5 })],
      NYCU_LAT,
      NYCU_LON,
    );
    expect(Number.isFinite(cones[0].topRadiusMeters)).toBe(true);
    // NaN-as-5 should produce the same topRadius as a real 5° beam.
    expect(cones[0].topRadiusMeters).toBeCloseTo(cones[1].topRadiusMeters, 5);
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
