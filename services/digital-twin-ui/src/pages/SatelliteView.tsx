/**
 * VS-13 S2/S3/S4 — CesiumJS satellite-pass viewer.
 *
 * S2 (PR #77): CesiumJS `<Viewer>` skeleton with NYCU ground-station Entity.
 * S3 (PR #78): static great-circle pass polyline + satellite Entity at peak.
 * S4 (this PR): per-beam coverage cones colored by snr_db, fed live from
 *               useMetricsPoll's BeamView[]. Pure-function geometry +
 *               color logic in src/lib/beam-cone.ts (no Cesium types —
 *               fully testable). Cesium models cones as cylinders with
 *               bottomRadius=0; resium's <CylinderGraphics> wraps it.
 *
 * Why resium (vs raw cesium): React-friendly declarative surface instead
 * of imperative `viewer.entities.add(...)` calls.
 *
 * Mock-friendly: tests stub `resium` + `cesium` so jsdom doesn't try
 * to load the WebGL runtime. See SatelliteView.test.tsx for the mock
 * contract. Pure-function libs (orbital-pass + beam-cone) run in tests
 * directly with no Cesium mocking.
 *
 * Static assets: scripts/copy-cesium-assets.mjs copies cesium runtime
 * into public/cesium/ via npm `predev` / `prebuild` / `pretest` hooks.
 * vite.config.ts exposes the path via CESIUM_BASE_URL=/cesium global.
 */
import { useEffect, useRef, useState } from "react";
import type { CesiumComponentRef } from "resium";
import type { Viewer as CesiumViewer } from "cesium";
import { Box, Button, Stack, Typography } from "@mui/material";
import {
  Viewer,
  Entity,
  PointGraphics,
  LabelGraphics,
  PolylineGraphics,
  CylinderGraphics,
  CameraFlyTo,
} from "resium";
import {
  Cartesian2,
  Cartesian3,
  Color,
  ImageryLayer,
  TileMapServiceImageryProvider,
} from "cesium";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { useTranslation } from "react-i18next";

import SectionHeader from "../components/SectionHeader";
import { calculateSinPass } from "../lib/orbital-pass";
import { calculateBeamCones } from "../lib/beam-cone";
import { interpolateSampleAtFraction } from "../lib/pass-animation";
import type { MetricsSnapshot } from "../types";

// VS-13 S5 (SPEC-S004-13d) — playback constants. Module-scope so they
// are stable across renders and discoverable by future tests that want
// to override deterministically.
const PLAYBACK_TICK_MS = 50;       // 20 fps animation tick.
const PLAYBACK_SPEED_X = 30;       // 30× wall-clock; 600 s pass plays in 20 s.

// VS-13 fix (2026-05-05): default Cesium <Viewer> uses Bing aerial
// imagery served by Cesium Ion CDN, which prints "default ion access
// token" warning and 401s once the demo token's rate limit is hit.
// Override with offline NaturalEarthII texture bundled into
// public/cesium/Assets/Textures/ by scripts/copy-cesium-assets.mjs.
// Zero Ion dependency, zero rate limit, zero signup, fully offline.
//
// Cesium 1.131+ replaced the deprecated `imageryProvider` constructor
// option with `baseLayer: ImageryLayer.fromProviderAsync(...)`; Resium
// 1.21 reflects the same readonly-prop surface (see resium d.ts line
// 653 — `cesiumReadonlyProps_18` includes `baseLayer`, NOT
// `imageryProvider`). `fromUrl` is the async factory that lazy-loads
// the tilemapresource.xml.
const OFFLINE_BASE_LAYER = ImageryLayer.fromProviderAsync(
  TileMapServiceImageryProvider.fromUrl(
    "/cesium/Assets/Textures/NaturalEarthII",
  ),
  {},
);

// NYCU ground-station anchor. Lat/lon picked to match the campus
// coordinates referenced in `docs/02_architecture.md`.
const NYCU_LAT = 24.787;
const NYCU_LON = 120.998;
const NYCU_ALT_M = 30;

// VS-13 fix (2026-05-05): default Cesium camera sits at lon=0 (above
// the Atlantic) ~10,000 km altitude. NYCU is at 120.998 °E — on the
// far side of the globe from default view, so the ground-station pin,
// pass polyline, satellite, and beam cones are all invisible until
// the user manually orbits the camera to Taiwan. That is the root
// cause of "screen has nothing" reported on /satellite-view.
//
// Fix: a <CameraFlyTo> on mount that frames the whole pass + ground
// station inside the viewport. ~5000 km altitude over NYCU shows the
// 16-degree-wide pass arc clearly without losing the world context.
// flyOnce={true} so subsequent re-renders (state updates from the
// playback interval) don't re-trigger the fly animation.
const INITIAL_CAMERA_DESTINATION = Cartesian3.fromDegrees(
  120.998, // NYCU lon
  20.0,    // a few degrees south so the pass arc + ground pin are both
           // comfortably above the horizon mid-frame, not hugging the
           // bottom of the canvas.
  5_000_000, // 5000 km — roughly 9× the LEO peak altitude; whole pass
             // visible, no zoom-in needed for first-impression.
);

// VS-13 S3: precompute one demo pass at module load. The default
// 600 s / 60-sample pass is replayed each page mount until S4+ wires
// in real TLE-driven orbits from the emulator.
const DEMO_PASS = calculateSinPass(NYCU_LAT, NYCU_LON);

// Convert PassSamples → Cartesian3 array for the polyline.
const POLYLINE_POSITIONS = DEMO_PASS.samples.map((s) =>
  Cartesian3.fromDegrees(s.lon_deg, s.lat_deg, s.alt_m),
);

interface SatelliteViewProps {
  data: MetricsSnapshot | null;
}

export default function SatelliteView({ data }: SatelliteViewProps) {
  const { t } = useTranslation();

  // VS-13 S4: derive beam cones from the live metrics snapshot. When
  // no scenario is loaded (data === null) the array is empty and the
  // viewer renders just the ground station + pass trace.
  // PR #79 review fix: pass NYCU_ALT_M as groundAltitudeMeters so
  // each cone's apex coincides exactly with the ground-station pin
  // (was 30 m below before — apex implicitly at sea level).
  const beams = data?.beams ?? [];
  const beamCones = calculateBeamCones(beams, NYCU_LAT, NYCU_LON, {
    groundAltitudeMeters: NYCU_ALT_M,
  });

  // VS-13 S5 (SPEC-S004-13d) — playback state. The fraction is the
  // canonical animation cursor; lon/lat/alt are derived. Start
  // paused at the entry point (fraction=0) instead of the old static
  // peak placement so the demo presenter explicitly starts playback.
  const [passFraction, setPassFraction] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // VS-13 fix v3 (2026-05-05) — clamp + dampen mouse interaction.
  // Reported: "敏感度太靈敏" — Cesium's default
  // ScreenSpaceCameraController has inertia = 0.9 (slow decay) and
  // unbounded zoom range, so a small scroll wheel tick shoots the
  // camera through the globe. Lower inertia + reasonable zoom bounds
  // (200 km min – 30,000 km max) keep the demo controllable.
  //
  // VS-13 fix v4 (2026-05-05): Cesium reads container.clientWidth at
  // construction time. With React 19 + Suspense + lazy chunk, the
  // parent flexbox may not have laid out yet → Cesium hardcodes
  // canvas to 300×150 default and never re-resizes. Force a resize
  // pass after mount + observe parent box for further size changes.
  const viewerRef = useRef<CesiumComponentRef<CesiumViewer>>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.minimumZoomDistance = 200_000;       // 200 km
    ctrl.maximumZoomDistance = 30_000_000;    // 30,000 km
    ctrl.inertiaSpin = 0.5;
    ctrl.inertiaTranslate = 0.5;
    ctrl.inertiaZoom = 0.5;

    // Kick a resize on next frame after layout settles.
    requestAnimationFrame(() => viewer.resize());

    // Observe parent box; on any layout change call viewer.resize so
    // canvas drawing buffer stays in sync with display size.
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => viewer.resize());
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // Interval-driven playback. Each tick advances fraction by
  // tickMs / (durationMs / speed). At fraction ≥ 1 we clamp + auto-
  // pause (predictable end-state for the demo). The cleanup function
  // clears the interval on (a) unmount, (b) isPlaying flipping false,
  // (c) any dependency change — preventing leaked timers across tests.
  useEffect(() => {
    if (!isPlaying) return;
    const durationMs = DEMO_PASS.durationSeconds * 1000;
    const id = setInterval(() => {
      setPassFraction((f) => {
        const next = f + (PLAYBACK_TICK_MS * PLAYBACK_SPEED_X) / durationMs;
        if (next >= 1) {
          // Auto-pause at end. Schedule the isPlaying flip in a
          // microtask to avoid a setState-during-render warning.
          queueMicrotask(() => setIsPlaying(false));
          return 1;
        }
        return next;
      });
    }, PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Current satellite sample, derived live from the fraction. New
  // Cartesian3 each render — bounded allocation (~12k over a full
  // playback at 20 fps) and zero new cesium mock surface (uses the
  // existing Cartesian3.fromDegrees mock).
  const currentSample = interpolateSampleAtFraction(
    DEMO_PASS.samples,
    passFraction,
  );
  const satellitePosition = Cartesian3.fromDegrees(
    currentSample.lon_deg,
    currentSample.lat_deg,
    currentSample.alt_m,
  );

  return (
    <Box>
      <SectionHeader
        category="Visualization"
        title="Satellite Pass"
        subtitle={
          beams.length > 0
            ? `CesiumJS world view: NYCU ground station + great-circle pass + ${beams.length} per-beam coverage cone${beams.length === 1 ? "" : "s"} colored by snr_db (live from /metrics).`
            : "CesiumJS world view with NYCU ground station + great-circle pass. Load a scenario to see per-beam coverage cones colored by snr_db."
        }
      />

      <Box
        ref={boxRef}
        sx={{
          height: "70vh",
          width: "100%",
          // VS-13 fix v3 (2026-05-05): inset:0 absolute fill is the
          // robust pattern. Resium's wrapping div has no inherent
          // size; making it `position:absolute; inset:0` against this
          // `position:relative` Box guarantees it fills the available
          // 70vh × 100% area before Cesium reads container size in
          // its constructor. !important on cesium-internal class
          // names backstops Cesium's inline attribute writes.
          position: "relative",
          borderRadius: 1,
          overflow: "hidden",
          "& > div": {
            position: "absolute !important",
            inset: 0,
            width: "100% !important",
            height: "100% !important",
          },
          "& .cesium-viewer, & .cesium-widget, & .cesium-viewer-cesiumWidgetContainer":
            {
              width: "100% !important",
              height: "100% !important",
              position: "absolute !important",
              inset: 0,
            },
          // VS-13 fix v4 (2026-05-05): Cesium 1.141's canvas does NOT
          // get the `cesium-widget-canvas` class — verified via live
          // DOM dump (cesium-widget > <canvas width="300" height="150">
          // with no class). The class-specific selector missed; use
          // a plain `& canvas` descendant selector.
          "& canvas": {
            width: "100% !important",
            height: "100% !important",
          },
          // VS-13 fix v3: hide the built-in Cesium credit container
          // ("CESIUM ion" watermark + Bing logo). NaturalEarthII is
          // public-domain (Tom Patterson via Cesium); attribution
          // moved to the page's caption Typography below.
          "& .cesium-viewer-bottom, & .cesium-credit-textContainer, & .cesium-credit-logoContainer":
            { display: "none !important" },
        }}
      >
        <Viewer
          ref={viewerRef}
          style={{ height: "100%", width: "100%" }}
          baseLayer={OFFLINE_BASE_LAYER}
          timeline={false}
          animation={false}
          baseLayerPicker={false}
          geocoder={false}
          homeButton={false}
          sceneModePicker={false}
          navigationHelpButton={false}
          // VS-13 fix v3: disable the 4 default widgets that were
          // escaping into the document flow when the cesium widget
          // container computed at small intrinsic size — observed
          // in the live cluster screenshot as floating fullscreen
          // icons + "×" close button + audio-mute icon.
          fullscreenButton={false}
          infoBox={false}
          selectionIndicator={false}
          vrButton={false}
        >
          <CameraFlyTo
            destination={INITIAL_CAMERA_DESTINATION}
            duration={2}
            once={true}
          />
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
            name="Satellite"
            position={satellitePosition}
            description={`Animated demo pass position: ${currentSample.lat_deg.toFixed(2)}°N, ${currentSample.lon_deg.toFixed(2)}°E, ${(currentSample.alt_m / 1000).toFixed(0)} km. Click Play to traverse the pass at ${PLAYBACK_SPEED_X}× wall clock.`}
            data-pass-fraction={passFraction}
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

          {/* VS-13 S4: one CylinderGraphics per beam. Cesium models
              cones as cylinders with bottomRadiusMeters=0 (apex at
              ground). Color tracks snr_db using the same red/yellow/
              green thresholds as the Beams page StatusChip. */}
          {beamCones.map((cone) => (
            <Entity
              key={cone.beam_id}
              name={`Beam ${cone.beam_id} coverage cone`}
              description={`Coverage cone for ${cone.beam_id}. Color = snr health (red ≤6 dB / yellow 6–12 dB / green >12 dB). Apex at NYCU; opening at ${(cone.lengthMeters / 1000).toFixed(0)} km altitude with footprint radius ${(cone.topRadiusMeters / 1000).toFixed(0)} km.`}
              position={Cartesian3.fromDegrees(
                cone.position.lon_deg,
                cone.position.lat_deg,
                cone.position.alt_m,
              )}
            >
              <CylinderGraphics
                length={cone.lengthMeters}
                topRadius={cone.topRadiusMeters}
                bottomRadius={cone.bottomRadiusMeters}
                material={Color.fromCssColorString(cone.color.hex).withAlpha(
                  cone.color.alpha,
                )}
                outline
                outlineColor={Color.fromCssColorString(cone.color.hex)}
                outlineWidth={1}
              />
            </Entity>
          ))}
        </Viewer>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={() => setIsPlaying(true)}
          disabled={isPlaying || passFraction >= 1}
        >
          {t("satellite.playback.play")}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PauseRoundedIcon />}
          onClick={() => setIsPlaying(false)}
          disabled={!isPlaying}
        >
          {t("satellite.playback.pause")}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RestartAltRoundedIcon />}
          onClick={() => {
            setIsPlaying(false);
            setPassFraction(0);
          }}
        >
          {t("satellite.playback.reset")}
        </Button>
        <Typography
          variant="caption"
          sx={{ ml: 2, fontFamily: "monospace", color: "text.secondary" }}
        >
          {t("satellite.playback.progress", {
            t: Math.round(currentSample.t_seconds),
            duration: DEMO_PASS.durationSeconds,
          })}{" "}
          {t("satellite.playback.speedHint", { speed: PLAYBACK_SPEED_X })}
        </Typography>
      </Stack>

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 2, color: "text.secondary" }}
      >
        VS-13 S3 + S4 + S5: animated great-circle pass over NYCU
        ({DEMO_PASS.durationSeconds}s, {DEMO_PASS.samples.length} samples) +{" "}
        {beams.length} per-beam coverage cone{beams.length === 1 ? "" : "s"}
        {beams.length > 0 ? ` (apex at NYCU, opening upward; color = snr_db health)` : ""}.
        Real TLE propagation and per-beam azimuth pointing are future PRs —
        current cones point straight up (zenith) regardless of scenario
        azimuth. See src/lib/orbital-pass.ts, src/lib/pass-animation.ts,
        and src/lib/beam-cone.ts.
      </Typography>
    </Box>
  );
}
