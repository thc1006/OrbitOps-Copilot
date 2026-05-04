/**
 * VS-13 S2 — CesiumJS satellite-pass viewer skeleton.
 *
 * Closes SPEC-004 §AC-S004-3 partial: the page mounts a CesiumJS
 * `<Viewer>` (via resium) with NYCU's ground station as the anchor
 * Entity. S3 (PR after this) layers a satellite pass polyline; S4
 * adds per-beam coverage cones.
 *
 * Why resium (vs raw cesium): we want a React-friendly declarative
 * surface instead of imperative `viewer.entities.add(...)` calls.
 * resium is the de-facto React + Cesium binding (~430 stars on GH,
 * actively maintained as of 2026-05).
 *
 * Mock-friendly: tests stub `resium` + `cesium` so jsdom doesn't try
 * to load the 3 MB WebGL runtime. See SatelliteView.test.tsx for the
 * mock contract.
 *
 * Static assets: vite.config.ts copies node_modules/cesium/Build/Cesium/
 * into dist/cesium/ at build time and exposes the path via the
 * `CESIUM_BASE_URL` global. Without that, cesium 404s on its Workers
 * + Assets at runtime.
 */
import { Box, Typography } from "@mui/material";
import { Viewer, Entity, PointGraphics, LabelGraphics } from "resium";
import { Cartesian3, Color } from "cesium";

import SectionHeader from "../components/SectionHeader";

// NYCU ground-station anchor. Lat/lon picked to match the campus
// coordinates referenced in `docs/02_architecture.md`. S3 will use
// this anchor as the great-circle origin for the pass polyline.
const NYCU_LAT = 24.787;
const NYCU_LON = 120.998;
const NYCU_ALT_M = 30;

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
              pixelOffset={Cartesian3.fromDegrees(0, 18, 0)}
            />
          </Entity>
        </Viewer>
      </Box>

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 2, color: "text.secondary" }}
      >
        Sprint-3 VS-13.2 skeleton. S3 adds the satellite pass polyline;
        S4 adds per-beam coverage cones colored by snr_db. The actual
        TLE → orbit propagation is fed from a future emulator surface
        (not in this PR).
      </Typography>
    </Box>
  );
}
