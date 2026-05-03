import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AssistantRoundedIcon from "@mui/icons-material/AssistantRounded";

import SectionHeader from "../components/SectionHeader";
import MetricSparkline from "../components/MetricSparkline";
import type { BeamMetricKey } from "../components/BeamMetricChart";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import { askCopilot } from "../api";
import { monoFamily } from "../theme";
import type { CopilotResponse, MetricsSnapshot } from "../types";

// Map metric NAMES (from MetricCitation.name) to BeamView KEYS (used by
// the sparkline). Citations come from the Prom exposition (gauge name);
// BeamView is the parsed-into-typed-shape. Keep the mapping local so
// adding a metric only touches one place.
const METRIC_NAME_TO_BEAM_KEY: Record<string, BeamMetricKey> = {
  orbitops_beam_snr_db: "snr_db",
  orbitops_beam_sinr_db: "sinr_db",
  orbitops_link_latency_ms: "latency_ms",
  orbitops_packet_loss_ratio: "packet_loss_ratio",
  orbitops_doppler_residual_hz: "doppler_residual_hz",
  orbitops_beam_elevation_deg: "elevation_deg",
};

interface CopilotProps {
  data: MetricsSnapshot | null;
}

const PRESET_QUESTIONS = [
  "Which beam is degrading and why?",
  "Is any gateway at risk of falling over?",
  "What should the operator do in the next 30 minutes?",
];

const STATUS_COLORS: Record<CopilotResponse["status"], "success" | "warning" | "error" | "default"> = {
  ok: "success",
  INSUFFICIENT_EVIDENCE: "warning",
  REFUSED: "error",
  ERROR: "error",
};

export default function Copilot({ data }: CopilotProps) {
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<CopilotResponse | null>(null);

  // VS-9b.4: accumulate the same sliding-window history the Beams page
  // uses, so each metric citation can render an inline sparkline of
  // the cited (beam_id, metric) trajectory.
  const history = useMetricsHistory(data);

  const ask = async (q: string) => {
    setBusy(true);
    setResponse(null);
    const r = await askCopilot({
      question: q,
      scenario_id: data?.scenario_id ?? undefined,
      time_window_seconds: 60,
    });
    setResponse(r);
    setBusy(false);
  };

  return (
    <Box>
      <SectionHeader
        category="AI Ops"
        title="Copilot"
        subtitle="Evidence-grounded NTN ops assistant. Every response is constrained to /metrics observations; the model never invents data. Status field tells you which path the response took."
      />

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="stretch">
          <TextField
            fullWidth
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about beam health, gateway availability, anomalies…"
            multiline
            minRows={2}
            disabled={busy}
          />
          <Button
            variant="contained"
            onClick={() => ask(question)}
            disabled={busy || question.trim().length === 0}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}
            sx={{ minWidth: 140, alignSelf: { md: "flex-end" } }}
          >
            {busy ? "Asking…" : "Ask Copilot"}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}>
          <Typography variant="caption" sx={{ alignSelf: "center", mr: 1 }}>
            Try:
          </Typography>
          {PRESET_QUESTIONS.map((q) => (
            <Chip
              key={q}
              label={q}
              variant="outlined"
              size="small"
              onClick={() => {
                setQuestion(q);
                ask(q);
              }}
              disabled={busy}
            />
          ))}
        </Stack>
      </Paper>

      {busy && <LinearProgress />}

      {response && (
        <Paper sx={{ p: 0, overflow: "hidden" }}>
          <Box sx={{ px: 3, py: 2, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <AssistantRoundedIcon color="primary" />
              <Typography variant="subtitle1">Copilot response</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Chip
                label={response.status}
                color={STATUS_COLORS[response.status]}
                size="small"
                sx={{ fontFamily: monoFamily }}
              />
              <Typography variant="caption" sx={{ ml: 2, color: "text.secondary" }}>
                confidence {Math.round(response.confidence * 100)}%
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ p: 3 }}>
            {response.status === "REFUSED" && response.refusal_reason && (
              <Typography variant="body2" sx={{ mb: 2, color: "error.main" }}>
                Refused: {response.refusal_reason}
              </Typography>
            )}

            {response.summary && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Summary
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                  {response.summary}
                </Typography>
              </Box>
            )}

            {response.likely_cause && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Likely cause
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {response.likely_cause}
                </Typography>
              </Box>
            )}

            {response.recommended_actions.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Recommended actions
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {response.recommended_actions.map((a) => (
                    <Box
                      key={a.step}
                      sx={{
                        p: 1.5,
                        borderLeft: 3,
                        borderColor: "primary.main",
                        bgcolor: "action.hover",
                      }}
                    >
                      <Typography variant="subtitle2">
                        {a.step}. {a.title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {a.body}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {response.risk_if_ignored && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Risk if ignored
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.5,
                    p: 1.5,
                    borderLeft: 3,
                    borderColor: "warning.main",
                    bgcolor: "action.hover",
                  }}
                >
                  {response.risk_if_ignored}
                </Typography>
              </Box>
            )}

            {response.evidence.metrics_used.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Metric citations ({response.evidence.metrics_used.length})
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    mt: 1,
                    pl: 2,
                    fontFamily: monoFamily,
                    fontSize: "0.75rem",
                    color: "text.secondary",
                  }}
                >
                  {response.evidence.metrics_used.map((m, i) => {
                    // VS-9b.4: render an inline sparkline next to the
                    // citation when the metric is one we have a beam-
                    // keyed history for AND the citation has a beam_id
                    // label. Other citation shapes (gateway-keyed,
                    // unlabeled) skip the chart and keep just text.
                    const beamKey = METRIC_NAME_TO_BEAM_KEY[m.name];
                    const beamId = m.labels.beam_id;
                    return (
                      <Box component="li" key={i} sx={{ mb: 1.5 }}>
                        <Box>
                          {m.name}
                          {Object.keys(m.labels).length > 0
                            ? `{${Object.entries(m.labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
                            : ""}
                          {" = "}
                          <Box component="strong" sx={{ color: "text.primary" }}>
                            {m.value}
                          </Box>
                        </Box>
                        {beamKey && beamId && (
                          <Box
                            data-testid={`sparkline-${m.name}-${beamId}`}
                            sx={{ mt: 0.5, ml: -1 }}
                          >
                            <MetricSparkline
                              history={history}
                              beamId={beamId}
                              metric={beamKey}
                            />
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {response.unknowns.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary">
                  Unknowns
                </Typography>
                <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                  {response.unknowns.map((u, i) => (
                    <Box component="li" key={i} sx={{ mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{u}</Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {/* Evidence metadata: per-ADR-004, the v2 Evidence model fields are
                metrics_used / logs_used / scenario_id / time_window_seconds /
                timestamp. metrics_used is rendered above as the citation list;
                this footer surfaces the other 4 so the demo presenter can prove
                the response is bound to a specific scenario + time window. */}
            <Divider sx={{ my: 2 }} />
            <Stack
              direction="row"
              spacing={3}
              flexWrap="wrap"
              useFlexGap
              sx={{
                fontFamily: monoFamily,
                fontSize: "0.6875rem",
                color: "text.secondary",
              }}
            >
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  scenario_id
                </Typography>
                <Box>{response.evidence.scenario_id ?? "(none)"}</Box>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  time_window_seconds
                </Typography>
                <Box>{response.evidence.time_window_seconds ?? "—"}</Box>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  timestamp
                </Typography>
                <Box>{response.evidence.timestamp}</Box>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  logs_used
                </Typography>
                <Box>
                  {response.evidence.logs_used.length} entr{response.evidence.logs_used.length === 1 ? "y" : "ies"}
                  {response.evidence.logs_used.length === 0 && " (Loki integration is Sprint-2 VS-10)"}
                </Box>
              </Box>
            </Stack>

            {response.error && (
              <Typography variant="caption" sx={{ display: "block", mt: 2, color: "error.main" }}>
                error: {response.error}
              </Typography>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
