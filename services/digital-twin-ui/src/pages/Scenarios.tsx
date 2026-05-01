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

export default function Scenarios({ refetchMetrics }: ScenariosProps) {
  const [busy, setBusy] = useState(false);
  const [tickSeconds, setTickSeconds] = useState(30);
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error" | "info";
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
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleLoad}
              disabled={busy}
              startIcon={<PlayArrowRoundedIcon />}
            >
              Load preset
            </Button>
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
