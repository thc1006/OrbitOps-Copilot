import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import FastForwardRoundedIcon from "@mui/icons-material/FastForwardRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { useTranslation } from "react-i18next";

import SectionHeader from "../components/SectionHeader";
import { loadScenario, tickScenario } from "../api";
import { monoFamily } from "../theme";

// `src/scenarios/beam-degradation.json` is a tracked **mirror** of the
// canonical `packages/scenarios/beam-degradation.json`. `verify.sh`
// gate `1d` (json drift) asserts the two are byte-equal — so editing
// the canonical and forgetting to update the mirror fails CI loudly.
// Why a mirror and not a cross-root import: vitest's test-mode resolver
// rejects file-system reads outside the project root, even when
// `vite.config.ts` aliases it. A mirror sidesteps the test-runner issue
// without giving up drift detection.
import PRESET_BEAM_DEGRADATION from "../scenarios/beam-degradation.json";
import PRESET_HANDOVER_FAILURE from "../scenarios/handover-failure.json";
import PRESET_GATEWAY_FALLBACK from "../scenarios/gateway-fallback.json";

// 3 Sprint-1 preset scenarios. Custom-JSON load is VS-3 future. Adding a
// preset here means: (a) drop the JSON into `packages/scenarios/`, (b) copy
// to `src/scenarios/` mirror so verify.sh drift gate passes, (c) add an
// entry below.
type ScenarioPreset = {
  id: string;
  // Each scenario JSON has slightly different event shapes (snr_drop has
  // magnitude_db; doppler_spike has magnitude_hz; etc.) — `Record<string,
  // unknown>` matches `loadScenario`'s parameter type and lets all 3 fit.
  // Server-side schema validation is the authoritative gate.
  body: Record<string, unknown>;
  /** i18n key under scenarios.preset.* — resolved at render time */
  labelKey: string;
  description: string;
};
const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "beam-degradation-001",
    body: PRESET_BEAM_DEGRADATION,
    labelKey: "scenarios.preset.beamDegradation",
    description:
      "3 beams (12.5 / 13.0 / 11.5 dB baseline). At t=60s, beam-1 drops 6 dB for 90 s (snr_drop). Walks AC-001.",
  },
  {
    id: "handover-failure-001",
    body: PRESET_HANDOVER_FAILURE,
    labelKey: "scenarios.preset.handoverFailure",
    description:
      "At t=90s, beam-1 enters handover_failure for 60 s (state=2) plus a concurrent doppler_spike t=90..120. Tick to t=120 to land mid-window. Walks AC-002.",
  },
  {
    id: "gateway-fallback-001",
    body: PRESET_GATEWAY_FALLBACK,
    labelKey: "scenarios.preset.gatewayFallback",
    description:
      "Gateway-outage scenario. orbitops_gateway_available drops to 0 during the event window. Walks AC-002 (gateway path).",
  },
];

interface ScenariosProps {
  refetchMetrics: () => void;
}

// VS-8 full: lands inside the snr_drop window (t=60..150) of
// beam-degradation-001 so /ask never returns INSUFFICIENT_EVIDENCE
// on the first question after `Ready for Copilot` is clicked.
// Module-scope so it doesn't reallocate every render.
const READY_TICK_SECONDS = 90;

export default function Scenarios({ refetchMetrics }: ScenariosProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [tickSeconds, setTickSeconds] = useState(30);
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error" | "info" | "warning";
    text: string;
  } | null>(null);

  const handleLoad = async (preset: ScenarioPreset = SCENARIO_PRESETS[0]) => {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await loadScenario(preset.body);
      setFeedback({
        severity: "success",
        text: `Loaded ${r.loaded}: ${r.beams} beams, ${r.gateways} gateway(s).`,
      });
      refetchMetrics();
    } catch (e) {
      setFeedback({ severity: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleTick = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await tickScenario(tickSeconds);
      setFeedback({
        severity: r.active_anomalies.length ? "info" : "success",
        text: `t = ${r.t}s · active: ${r.active_anomalies.join(", ") || "(none)"}`,
      });
      refetchMetrics();
    } catch (e) {
      setFeedback({ severity: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // VS-8 full — one-click `Ready for Copilot`: load + tick into the
  // anomaly window so a fresh evaluator session never hits the
  // INSUFFICIENT_EVIDENCE state on /ask. The READY_TICK_SECONDS
  // constant lives at module scope above; PR #41 documents the manual
  // 4-step equivalent in docs/08_demo_script_3min.md "Demo execution checklist".
  const handleReadyForCopilot = async () => {
    setBusy(true);
    setFeedback(null);

    // PR #42 review (Copilot bot, round 2): split the load + tick into
    // two try blocks. If load succeeds but tick fails, the emulator is
    // in a partial state (loaded, t=0) — we need to (a) tell the user
    // exactly that, not a generic error, and (b) still call
    // refetchMetrics so the metrics view doesn't stay stale.
    let loaded: Awaited<ReturnType<typeof loadScenario>>;
    try {
      loaded = await loadScenario(PRESET_BEAM_DEGRADATION);
    } catch (e) {
      setFeedback({
        severity: "error",
        text: `Load failed before any state changed: ${(e as Error).message}`,
      });
      setBusy(false);
      return;
    }
    refetchMetrics();

    try {
      const ticked = await tickScenario(READY_TICK_SECONDS);
      // An empty `active_anomalies` after the tick means we did NOT
      // actually land in the anomaly window (scenario shifted, or the
      // tick constant fell outside the event range). Reporting "Ready
      // for Copilot" in that state would be misleading — /ask will
      // return INSUFFICIENT_EVIDENCE. Surface it as a warning so the
      // demo presenter sees the problem before recording.
      if (ticked.active_anomalies.length === 0) {
        setFeedback({
          severity: "warning",
          text:
            `${loaded.loaded} loaded but NO anomaly is active at t=${ticked.t}s ` +
            `— Copilot will return INSUFFICIENT_EVIDENCE. ` +
            `Re-load and try a different tick value, or check the scenario file.`,
        });
      } else {
        setFeedback({
          severity: "success",
          text:
            `${t("scenarios.readyForCopilot")} · ${loaded.loaded} loaded, ` +
            `t = ${ticked.t}s · active: ${ticked.active_anomalies.join(", ")} · ` +
            t("scenarios.checklist.askCopilot"),
        });
      }
      refetchMetrics();
    } catch (e) {
      setFeedback({
        severity: "error",
        text:
          `${loaded.loaded} loaded (t=0) but tick failed: ${(e as Error).message}. ` +
          t("scenarios.checklist.retryHint"),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <SectionHeader
        category={t("nav.cluster")}
        title={t("nav.scenarios")}
        subtitle={t("scenarios.subtitle")}
      />

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Presets — 3 Sprint-1 scenarios
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Click a preset to POST it to <code>/scenario/load</code> on the emulator.{" "}
            {t("scenarios.customLoadFutureWork")}{" "}
            <strong>{t("scenarios.readyForCopilot")}</strong>{" "}
            (below) is a one-click <em>load + tick to t={READY_TICK_SECONDS}s</em> for{" "}
            <code>beam-degradation-001</code> only — designed so a fresh demo session
            lands inside the snr_drop window before Copilot is asked anything.
          </Typography>
          <Stack spacing={1.5}>
            {SCENARIO_PRESETS.map((preset) => (
              <Box key={preset.id}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    onClick={() => handleLoad(preset)}
                    disabled={busy}
                    startIcon={<PlayArrowRoundedIcon />}
                    sx={{ minWidth: 220 }}
                  >
                    {t(preset.labelKey)}
                  </Button>
                  {preset.id === "beam-degradation-001" && (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleReadyForCopilot}
                      disabled={busy}
                      startIcon={<RocketLaunchRoundedIcon />}
                    >
                      {t("scenarios.readyForCopilot")}
                    </Button>
                  )}
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ mt: 0.5, display: "block", color: "text.secondary" }}
                >
                  {preset.description}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Box
            component="pre"
            sx={{
              mt: 3,
              p: 2,
              bgcolor: "grey.50",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              fontFamily: monoFamily,
              fontSize: "0.6875rem",
              maxHeight: 280,
              overflow: "auto",
              color: "text.secondary",
            }}
          >
            {JSON.stringify(PRESET_BEAM_DEGRADATION, null, 2)}
          </Box>
        </Paper>

        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Advance time
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Increment the emulator's internal clock. Past t=60s, the snr_drop
            event activates and beam-1's SNR falls to 6.5 dB.
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              label={t("scenarios.tickPickLabel")}
              type="number"
              value={tickSeconds}
              onChange={(e) => setTickSeconds(Number(e.target.value) || 0)}
              sx={{ width: 140 }}
              slotProps={{ htmlInput: { min: 0, max: 86400 } }}
            />
            <Button
              variant="contained"
              onClick={handleTick}
              disabled={busy}
              startIcon={<FastForwardRoundedIcon />}
            >
              Tick + {tickSeconds}s
            </Button>
            <ButtonGroup size="small" variant="outlined">
              {[10, 30, 60, 90].map((n) => (
                <Button key={n} onClick={() => setTickSeconds(n)} disabled={busy}>
                  {n}s
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
        </Paper>
      </Stack>

      {feedback && (
        <Alert severity={feedback.severity} sx={{ mt: 3 }}>
          {feedback.text}
        </Alert>
      )}
    </Box>
  );
}
