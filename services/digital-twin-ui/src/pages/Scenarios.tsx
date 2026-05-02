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

interface ScenariosProps {
  refetchMetrics: () => void;
}

// VS-8 full: lands inside the snr_drop window (t=60..150) of
// beam-degradation-001 so /ask never returns INSUFFICIENT_EVIDENCE
// on the first question after `Ready for Copilot` is clicked.
// Module-scope so it doesn't reallocate every render.
const READY_TICK_SECONDS = 90;

export default function Scenarios({ refetchMetrics }: ScenariosProps) {
  const [busy, setBusy] = useState(false);
  const [tickSeconds, setTickSeconds] = useState(30);
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error" | "info" | "warning";
    text: string;
  } | null>(null);

  const handleLoad = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await loadScenario(PRESET_BEAM_DEGRADATION);
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
            `Ready for Copilot · ${loaded.loaded} loaded, ` +
            `t = ${ticked.t}s · active: ${ticked.active_anomalies.join(", ")} · ` +
            `Open the Copilot tab and ask "Which beam is degrading and why?"`,
        });
      }
      refetchMetrics();
    } catch (e) {
      setFeedback({
        severity: "error",
        text:
          `${loaded.loaded} loaded (t=0) but tick failed: ${(e as Error).message}. ` +
          `Click "Tick + Ns" to retry, or "Load preset" to reset.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <SectionHeader
        category="Cluster"
        title="Scenarios"
        subtitle="Load a scenario into the emulator and advance simulated time. The Sprint-1 baseline ships one preset (beam-degradation-001); custom JSON support lands in VS-3."
      />

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Preset · beam-degradation-001
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            3 beams (12.5 / 13.0 / 11.5 dB baseline). At t=60s, beam-1 drops 6 dB
            for 90 s (snr_drop anomaly). Use this to walk through AC-001.
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              onClick={handleLoad}
              disabled={busy}
              startIcon={<PlayArrowRoundedIcon />}
            >
              Load preset
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleReadyForCopilot}
              disabled={busy}
              startIcon={<RocketLaunchRoundedIcon />}
            >
              Ready for Copilot
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ mt: 1.5, display: "block", color: "text.secondary" }}>
            <strong>Ready for Copilot</strong>: one-click load + tick to t={READY_TICK_SECONDS}s
            (mid-anomaly). Use this before recording the demo so /ask never returns
            INSUFFICIENT_EVIDENCE on the first question.
          </Typography>
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
              label="Seconds"
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
