import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";

import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import { monoFamily } from "../theme";
import type { MetricsSnapshot } from "../types";

interface AnomaliesProps {
  data: MetricsSnapshot | null;
}

// This page renders `data.active_anomalies`, which is populated from
// `/scenario/current` — the emulator's `_compute.active_anomaly_types()`
// only returns the 5 producer-emitted SCENARIO event types. Copilot-derived
// classifications (e.g. `doppler_compensation_warning`) NEVER appear here
// because they're computed by `_retrieval.classify()` on the copilot-api
// side and surface only in the Copilot response shape. Hence this
// dictionary is keyed strictly to the 5 scenario-event enum values.
const ANOMALY_DESCRIPTIONS: Record<string, string> = {
  snr_drop:
    "Signal-to-noise ratio on at least one beam fell below the link-adaptation threshold. Most often: low-elevation pointing combined with a transient RF environment shift (rain-fade, pointing error).",
  handover_failure:
    "Beam handover did not complete within the timer window. Service interruption visible to UE; investigate gateway reachability and beam scheduling.",
  doppler_spike:
    "Scenario-injected Doppler perturbation. Adds magnitude_hz to orbitops_doppler_residual_hz on the target beam for the event window. If the resulting residual exceeds 2 kHz (≈⅔ of the 10%-SCS=30 kHz operational ceiling per 3GPP TS 38.821), Copilot will classify it as doppler_compensation_warning on the Copilot page.",
  gateway_outage:
    "Gateway availability gauge dropped to 0. Either the gateway service is down or the emulator scenario explicitly modelled an outage event.",
  packet_loss_spike:
    "Per-beam packet-loss ratio jumped (orbitops_packet_loss_ratio adds 0.3, capped at 0.5). Usually downstream of an RF / buffer hiccup, not a root cause in itself.",
};

export default function Anomalies({ data }: AnomaliesProps) {
  const active = data?.active_anomalies ?? [];

  return (
    <Box>
      <SectionHeader
        category="Events"
        title="Anomalies"
        subtitle="Live anomaly events reported by the emulator. The Sprint-1 emulator surfaces a single active anomaly type at a time; multi-anomaly listing is forward-compatible."
      />

      {active.length === 0 ? (
        <Alert severity="success" icon={<EventNoteRoundedIcon />}>
          No active anomalies. The emulator scenario clock is in nominal range.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {active.map((kind) => (
            <Paper key={kind} sx={{ p: 3, borderLeft: 4, borderColor: "warning.main" }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                <Typography
                  variant="h6"
                  sx={{ fontFamily: monoFamily, fontWeight: 600 }}
                >
                  {kind}
                </Typography>
                <StatusChip status="warn" label="Active" />
              </Stack>
              <Typography variant="body2">
                {ANOMALY_DESCRIPTIONS[kind] ??
                  "Unknown anomaly type. The /metrics scrape reported it; check the scenario JSON for the event definition."}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1.5, color: "text.secondary" }}
              >
                Tip: ask the Copilot — it will cite the exact metric values
                that triggered this and recommend an action.
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
