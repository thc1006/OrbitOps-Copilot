/**
 * VS-13 S3 — pure-function tests for the orbital-pass calculator.
 *
 * Doesn't mount React or Cesium. Just exercises the math.
 */
import { describe, expect, test } from "vitest";

import { calculateSinPass } from "./orbital-pass";

const NYCU_LAT = 24.787;
const NYCU_LON = 120.998;

describe("calculateSinPass — defaults", () => {
  test("default pass is 10 minutes (600 s) with 60 samples", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON);
    expect(pass.durationSeconds).toBe(600);
    expect(pass.samples).toHaveLength(60);
  });

  test("first sample is t=0, last is t=duration, monotonically increasing", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON);
    expect(pass.samples[0].t_seconds).toBe(0);
    expect(pass.samples[pass.samples.length - 1].t_seconds).toBe(600);
    for (let i = 1; i < pass.samples.length; i++) {
      expect(pass.samples[i].t_seconds).toBeGreaterThan(
        pass.samples[i - 1].t_seconds,
      );
    }
  });

  test("altitude is sine-shaped: 0 at endpoints, peak at midpoint", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON);
    expect(pass.samples[0].alt_m).toBeCloseTo(0, 5);
    expect(pass.samples[pass.samples.length - 1].alt_m).toBeCloseTo(0, 5);

    // Mid-sample (index 29 or 30 of 60) should be the peak ~550 km.
    const midIdx = Math.floor(pass.samples.length / 2);
    expect(pass.samples[midIdx].alt_m).toBeGreaterThan(540_000);
    expect(pass.samples[midIdx].alt_m).toBeLessThanOrEqual(550_000);
  });

  test("default bearing is 90° — pass goes west to east, latitude stays near ground", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON);
    // 90° bearing → cos(90°) = 0 → no latitude drift; sin(90°) = 1 → full lon drift.
    for (const s of pass.samples) {
      expect(Math.abs(s.lat_deg - NYCU_LAT)).toBeLessThan(1e-9);
    }
    // Lon should sweep across the ground station from -8° to +8° / cos(NYCU_LAT).
    expect(pass.samples[0].lon_deg).toBeLessThan(NYCU_LON);
    expect(pass.samples[pass.samples.length - 1].lon_deg).toBeGreaterThan(
      NYCU_LON,
    );
  });
});

describe("calculateSinPass — custom options", () => {
  test("honors durationSeconds + sampleCount overrides", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON, {
      durationSeconds: 300,
      sampleCount: 31,
    });
    expect(pass.durationSeconds).toBe(300);
    expect(pass.samples).toHaveLength(31);
    expect(pass.samples[pass.samples.length - 1].t_seconds).toBe(300);
  });

  test("maxAltitudeMeters override changes peak altitude", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON, {
      maxAltitudeMeters: 408_000, // ISS altitude
    });
    const midIdx = Math.floor(pass.samples.length / 2);
    expect(pass.samples[midIdx].alt_m).toBeGreaterThan(400_000);
    expect(pass.samples[midIdx].alt_m).toBeLessThanOrEqual(408_000);
  });

  test("bearingDeg = 0 → pass goes south to north, longitude stays near ground", () => {
    const pass = calculateSinPass(NYCU_LAT, NYCU_LON, { bearingDeg: 0 });
    for (const s of pass.samples) {
      expect(Math.abs(s.lon_deg - NYCU_LON)).toBeLessThan(1e-9);
    }
    expect(pass.samples[0].lat_deg).toBeLessThan(NYCU_LAT);
    expect(pass.samples[pass.samples.length - 1].lat_deg).toBeGreaterThan(
      NYCU_LAT,
    );
  });

  test("rejects invalid options", () => {
    expect(() =>
      calculateSinPass(NYCU_LAT, NYCU_LON, { durationSeconds: 0 }),
    ).toThrow(/durationSeconds/);
    expect(() =>
      calculateSinPass(NYCU_LAT, NYCU_LON, { sampleCount: 1 }),
    ).toThrow(/sampleCount/);
  });
});
