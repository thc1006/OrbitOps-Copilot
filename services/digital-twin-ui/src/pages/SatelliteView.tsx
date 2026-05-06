/**
 * VS-13 S2/S3/S4/S5 + 2026-05-06 redesign — CesiumJS satellite-pass
 * ops console.
 *
 * Layout (8/4 split on lg, full-width stack on xs):
 *   - Left (8 cols, 60vh): CesiumJS globe with NYCU ground station +
 *     animated satellite + great-circle pass polyline + per-beam
 *     coverage cones colored by snr_db.
 *   - Right (4 cols): 4-panel telemetry sidebar:
 *     · Pass progress (LinearProgress + t/duration)
 *     · Active beams (per-beam SNR + StatusChip)
 *     · Handover events (per-beam handover_state ≥ 1)
 *     · Live SNR sparkline (60s sliding window via useMetricsHistory)
 *   - Above grid: anomaly banner (when active_anomalies non-empty)
 *   - Below grid: Play / Pause / Reset playback controls
 *
 * Why this layout: the previous full-width 70vh globe-only page
 * looked like a generic Cesium toy demo and didn't communicate the
 * NTN-ops domain story. This rewrite mirrors a real ground-station
 * ops console — globe is one panel among many, with live telemetry
 * driving the side panels from the same `data` prop already polled
 * upstream by useMetricsPoll.
 *
 * Mock-friendly: tests stub `resium` + `cesium` (see
 * src/test-helpers/cesium-mocks.tsx). Pure-function libs
 * (orbital-pass + pass-animation + beam-cone) run in tests directly.
 */
import { useEffect, useRef, useState } from "react";
import type { CesiumComponentRef } from "resium";
import type { Viewer as CesiumViewer } from "cesium";
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid2 as Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import { useTranslation } from "react-i18next";

import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import MetricNumber from "../components/MetricNumber";
import MetricSparkline from "../components/MetricSparkline";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import { calculateSinPass } from "../lib/orbital-pass";
import { calculateBeamCones } from "../lib/beam-cone";
import { interpolateSampleAtFraction } from "../lib/pass-animation";
import { monoFamily } from "../theme";
import type { MetricsSnapshot } from "../types";

// VS-13 S5 (SPEC-S004-13d) — playback constants. Module-scope so they
// are stable across renders and discoverable by future tests that want
// to override deterministically.
const PLAYBACK_TICK_MS = 50;
const PLAYBACK_SPEED_X = 30;

// Offline NaturalEarthII — see ADR-011. Bundled by
// scripts/copy-cesium-assets.mjs into public/cesium/.
const OFFLINE_BASE_LAYER = ImageryLayer.fromProviderAsync(
  TileMapServiceImageryProvider.fromUrl(
    "/cesium/Assets/Textures/NaturalEarthII",
  ),
  {},
);

// NYCU ground-station anchor.
const NYCU_LAT = 24.787;
const NYCU_LON = 120.998;
const NYCU_ALT_M = 30;

// Initial camera frames the whole pass arc + ground pin from above
// Taiwan; lat=20 puts the arc comfortably above the canvas horizon.
const INITIAL_CAMERA_DESTINATION = Cartesian3.fromDegrees(
  120.998,
  20.0,
  5_000_000,
);

const DEMO_PASS = calculateSinPass(NYCU_LAT, NYCU_LON);
const POLYLINE_POSITIONS = DEMO_PASS.samples.map((s) =>
  Cartesian3.fromDegrees(s.lon_deg, s.lat_deg, s.alt_m),
);

interface SatelliteViewProps {
  data: MetricsSnapshot | null;
}

export default function SatelliteView({ data }: SatelliteViewProps) {
  const { t } = useTranslation();
  const beams = data?.beams ?? [];
  const beamCones = calculateBeamCones(beams, NYCU_LAT, NYCU_LON, {
    groundAltitudeMeters: NYCU_ALT_M,
  });
  const activeAnomalies = data?.active_anomalies ?? [];
  const handoverEvents = beams.filter((b) => b.handover_state > 0);

  // 60s sliding-window per-beam metrics history for the sparkline panel.
  const history = useMetricsHistory(data);

  const [passFraction, setPassFraction] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mouse-interaction tuning per VS-13 fix v3 (clamp + dampen). Cesium
  // default inertia=0.9 made the camera feel runaway; 0.5 halves the
  // perceived sensitivity. Zoom range [200 km, 30,000 km] keeps demo
  // bounded.
  const viewerRef = useRef<CesiumComponentRef<CesiumViewer>>(null);
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.minimumZoomDistance = 200_000;
    ctrl.maximumZoomDistance = 30_000_000;
    ctrl.inertiaSpin = 0.5;
    ctrl.inertiaTranslate = 0.5;
    ctrl.inertiaZoom = 0.5;
  }, []);

  // Interval-driven playback. Auto-pauses at fraction=1.
  useEffect(() => {
    if (!isPlaying) return;
    const durationMs = DEMO_PASS.durationSeconds * 1000;
    const id = setInterval(() => {
      setPassFraction((f) => {
        const next = f + (PLAYBACK_TICK_MS * PLAYBACK_SPEED_X) / durationMs;
        if (next >= 1) {
          queueMicrotask(() => setIsPlaying(false));
          return 1;
        }
        return next;
      });
    }, PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  const currentSample = interpolateSampleAtFraction(
    DEMO_PASS.samples,
    passFraction,
  );
  const satellitePosition = Cartesian3.fromDegrees(
    currentSample.lon_deg,
    currentSample.lat_deg,
    currentSample.alt_m,
  );

  const handoverLabel = (state: number): string =>
    state === 2
      ? t("satellite.handover.failure")
      : state === 1
        ? t("satellite.handover.preparing")
        : "";

  return (
    <Box>
      <SectionHeader
        category={t("nav.workloads")}
        title={t("nav.satellitePass")}
        subtitle={t("satellite.subtitle")}
      />

      {activeAnomalies.length > 0 && (
        <Alert
          severity="warning"
          icon={<ReportProblemRoundedIcon />}
          sx={{ mb: 2 }}
        >
          {t("satellite.anomaly.banner", {
            kind: activeAnomalies.join(", "),
            t: data?.t_seconds ?? 0,
            count: beams.filter((b) => b.health !== "ok").length,
          })}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Globe panel — left 8 cols on lg, full width on xs */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box
            sx={{
              height: "60vh",
              width: "100%",
              position: "relative",
              borderRadius: 1,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
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
              "& canvas": { width: "100% !important", height: "100% !important" },
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
                  pixelOffset={new Cartesian2(0, -18)}
                />
              </Entity>

              <Entity name="Satellite Pass Trace">
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

              {beamCones.map((cone) => (
                <Entity
                  key={cone.beam_id}
                  name={`Beam ${cone.beam_id} coverage cone`}
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
        </Grid>

        {/* Telemetry sidebar — right 4 cols on lg, full width on xs */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2} sx={{ height: "60vh", overflowY: "auto" }}>
            {/* Pass progress */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                {t("satellite.timeline.title")}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={passFraction * 100}
                sx={{ my: 1, height: 6, borderRadius: 1 }}
              />
              <Typography
                variant="caption"
                sx={{ fontFamily: monoFamily, color: "text.secondary" }}
              >
                {t("satellite.playback.progress", {
                  t: Math.round(currentSample.t_seconds),
                  duration: DEMO_PASS.durationSeconds,
                })}{" "}
                {t("satellite.playback.speedHint", { speed: PLAYBACK_SPEED_X })}
              </Typography>
            </Paper>

            {/* Active beams */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                {t("satellite.beams.title", { count: beams.length })}
              </Typography>
              {beams.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {t("satellite.beams.empty")}
                </Typography>
              ) : (
                <Stack divider={<Divider />} spacing={1} sx={{ mt: 1 }}>
                  {beams.map((b) => (
                    <Stack
                      key={b.beam_id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: monoFamily }}
                      >
                        {b.beam_id}
                      </Typography>
                      <Box sx={{ minWidth: 80, textAlign: "right" }}>
                        <MetricNumber value={b.snr_db} unit="dB" />
                      </Box>
                      <StatusChip status={b.health} />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Handover events */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                {t("satellite.handover.title")}
              </Typography>
              {handoverEvents.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {t("satellite.handover.empty")}
                </Typography>
              ) : (
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {handoverEvents.map((b) => (
                    <Typography
                      key={b.beam_id}
                      variant="body2"
                      sx={{ fontFamily: monoFamily }}
                    >
                      {b.beam_id} ·{" "}
                      <Box
                        component="span"
                        sx={{
                          color:
                            b.handover_state === 2
                              ? "error.main"
                              : "warning.main",
                          fontWeight: 600,
                        }}
                      >
                        {handoverLabel(b.handover_state)}
                      </Box>
                    </Typography>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Live SNR sparkline (per beam) */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                {t("satellite.sparkline.title")}
              </Typography>
              {beams.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {t("satellite.sparkline.empty")}
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {beams.map((b) => (
                    <Stack
                      key={b.beam_id}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: monoFamily, minWidth: 60 }}
                      >
                        {b.beam_id}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <MetricSparkline
                          history={history}
                          beamId={b.beam_id}
                          metric="snr_db"
                        />
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* Playback controls — full width below grid */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}
      >
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
      </Stack>
    </Box>
  );
}
