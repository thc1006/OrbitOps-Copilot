/**
 * VS-13 S2/S3 — CesiumJS satellite-pass viewer.
 *
 * S2 (PR #77): CesiumJS `<Viewer>` skeleton with NYCU ground-station Entity.
 * S3 (this PR): static great-circle pass polyline + satellite Entity at the
 *               peak of the pass. Pure-function pass calculator lives in
 *               src/lib/orbital-pass.ts (no Cesium types — fully testable).
 *               Animation (SampledPositionProperty + play/pause) deferred
 *               to a future PR.
 * S4 (future):  per-beam coverage cones colored by snr_db.
 *
 * Why resium (vs raw cesium): React-friendly declarative surface instead
 * of imperative `viewer.entities.add(...)` calls. resium is the de-facto
 * React + Cesium binding, actively maintained as of 2026-05.
 *
 * Mock-friendly: tests stub `resium` + `cesium` so jsdom doesn't try
 * to load the WebGL runtime. See SatelliteView.test.tsx for the mock
 * contract. The pure-function pass calculator runs in tests directly
 * (no Cesium mocking — see orbital-pass.test.ts).
 *
 * Static assets: scripts/copy-cesium-assets.mjs copies cesium runtime
 * into public/cesium/ via npm `predev` / `prebuild` / `pretest` hooks.
 * vite.config.ts exposes the path via CESIUM_BASE_URL=/cesium global.
 */
import { Box, Typography } from "@mui/material";
import {
  Viewer,
  Entity,
  PointGraphics,
  LabelGraphics,
  PolylineGraphics,
} from "resium";
import { Cartesian2, Cartesian3, Color } from "cesium";

import SectionHeader from "../components/SectionHeader";
import { calculateSinPass } from "../lib/orbital-pass";

// NYCU ground-station anchor. Lat/lon picked to match the campus
// coordinates referenced in `docs/02_architecture.md`.
const NYCU_LAT = 24.787;
const NYCU_LON = 120.998;
const NYCU_ALT_M = 30;

// VS-13 S3: precompute one demo pass at module load. The default
// 600 s / 60-sample pass is replayed each page mount until S4+ wires
// in real TLE-driven orbits from the emulator.
const DEMO_PASS = calculateSinPass(NYCU_LAT, NYCU_LON);

// Convert PassSamples → Cartesian3 array for the polyline.
const POLYLINE_POSITIONS = DEMO_PASS.samples.map((s) =>
  Cartesian3.fromDegrees(s.lon_deg, s.lat_deg, s.alt_m),
);

// Satellite "current position" Entity sits at the peak of the pass
// (mid-sample). S4+ replaces this with a SampledPositionProperty that
// animates through all 60 samples over the pass duration.
const PEAK_SAMPLE = DEMO_PASS.samples[Math.floor(DEMO_PASS.samples.length / 2)];
const SATELLITE_POSITION = Cartesian3.fromDegrees(
  PEAK_SAMPLE.lon_deg,
  PEAK_SAMPLE.lat_deg,
  PEAK_SAMPLE.alt_m,
);

export default function SatelliteView() {
  return (
    <Box>
      <SectionHeader
        category="Visualization"
        title="Satellite Pass"
        subtitle="CesiumJS world view with NYCU ground station + (S3) satellite pass + (S4) per-beam coverage cones. WebGL — disable in jsdom-only environments."
      />

      <Box sx={{ height: "70vh", borderRadius: 1, overflow: "hidden" }}>
        <Viewer
          full
          timeline={false}
          animation={false}
          baseLayerPicker={false}
          geocoder={false}
          homeButton={false}
          sceneModePicker={false}
          navigationHelpButton={false}
        >
          <Entity
            name="NYCU Ground Station"
            position={Cartesian3.fromDegrees(NYCU_LON, NYCU_LAT, NYCU_ALT_M)}
            description="OrbitOps reference ground station. 24.787 °N, 120.998 °E."
          >
            <PointGraphics
              pixelSize={12}
              color={Color.fromCssColorString("#0055ff")}
              outlineColor={Color.fromCssColorString("#ffffff")}
              outlineWidth={2}
            />
            <LabelGraphics
              text="NYCU GS"
              font="14px sans-serif"
              fillColor={Color.fromCssColorString("#ffffff")}
              outlineColor={Color.fromCssColorString("#000000")}
              outlineWidth={2}
              // VS-13 S3 (2026-05-04, addresses PR #77 review #4):
              // pixelOffset is screen-space (Cartesian2 in pixels), not
              // world-space (Cartesian3 in degrees). Using Cartesian3
              // before would either be rejected by cesium at runtime
              // or place the label at world-space (0°N, 18°E, 0m) over
              // the equator instead of "18 px above the pin".
              // Negative Y = upward in screen-space coords.
              pixelOffset={new Cartesian2(0, -18)}
            />
          </Entity>

          <Entity
            name="Satellite Pass Trace"
            description={`Demo great-circle pass over NYCU. ${DEMO_PASS.durationSeconds}s, ${DEMO_PASS.samples.length} samples. S4+ replaces with TLE-driven orbits.`}
          >
            <PolylineGraphics
              positions={POLYLINE_POSITIONS}
              width={2}
              material={Color.fromCssColorString("#fdcb6e")}
              clampToGround={false}
            />
          </Entity>

          <Entity
            name="Satellite (peak)"
            position={SATELLITE_POSITION}
            description={`Peak position of the demo pass: ${PEAK_SAMPLE.lat_deg.toFixed(2)}°N, ${PEAK_SAMPLE.lon_deg.toFixed(2)}°E, ${(PEAK_SAMPLE.alt_m / 1000).toFixed(0)} km. Static placement; S4+ animates this through all 60 samples.`}
          >
            <PointGraphics
              pixelSize={10}
              color={Color.fromCssColorString("#ff7675")}
              outlineColor={Color.fromCssColorString("#ffffff")}
              outlineWidth={2}
            />
            <LabelGraphics
              text="SAT"
              font="13px sans-serif"
              fillColor={Color.fromCssColorString("#ffffff")}
              outlineColor={Color.fromCssColorString("#000000")}
              outlineWidth={2}
              pixelOffset={new Cartesian2(0, -16)}
            />
          </Entity>
        </Viewer>
      </Box>

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 2, color: "text.secondary" }}
      >
        VS-13 S3: static great-circle pass over NYCU ({DEMO_PASS.durationSeconds}s,{" "}
        {DEMO_PASS.samples.length} samples; peak{" "}
        {(PEAK_SAMPLE.alt_m / 1000).toFixed(0)} km). Animation
        (SampledPositionProperty + play/pause) and per-beam coverage
        cones colored by snr_db are future PRs. TLE → orbit propagation
        is fed from a future emulator surface — current pass uses a
        sin-shaped altitude profile + linear great-circle interpolation
        (see src/lib/orbital-pass.ts).
      </Typography>
    </Box>
  );
}
