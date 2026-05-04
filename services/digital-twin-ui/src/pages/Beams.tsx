import { Box, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import MetricNumber from "../components/MetricNumber";
import BeamMetricChart, {
  type BeamMetricKey,
} from "../components/BeamMetricChart";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import { monoFamily } from "../theme";
import type { MetricsSnapshot } from "../types";

// VS-9b.3: render 3 time-series charts (SNR / Latency / Doppler) above
// the per-beam table. PacketLoss intentionally NOT rendered — it
// rarely changes outside an injected anomaly window, and 4 stacked
// charts crowd the viewport.
//
// T1 (i18n): titles + units now come from the i18n bundle so locale
// switching (en / zh-TW) reflects in chart captions. The `metric`
// field stays English (it's the JS object key, not a display label).
const BEAMS_PAGE_CHARTS: ReadonlyArray<{
  metric: BeamMetricKey;
  titleKey: string;
  unitKey: string;
}> = [
  { metric: "snr_db", titleKey: "beams.snrTitle", unitKey: "beams.snrUnit" },
  {
    metric: "latency_ms",
    titleKey: "beams.latencyTitle",
    unitKey: "beams.latencyUnit",
  },
  {
    metric: "doppler_residual_hz",
    titleKey: "beams.dopplerTitle",
    unitKey: "beams.dopplerUnit",
  },
] as const;

interface BeamsProps {
  data: MetricsSnapshot | null;
}

export default function Beams({ data }: BeamsProps) {
  const { t } = useTranslation();
  const beams = data?.beams ?? [];
  // VS-9b.2: accumulate snapshots into a 60-entry sliding window
  // (5-minute trail at 5 s scrape cadence) so the LineChart has data to
  // draw against. Hook is pure — passes through `data` from useMetricsPoll.
  const history = useMetricsHistory(data);

  return (
    <Box>
      <SectionHeader
        category="Workloads"
        title="Beams"
        subtitle="Per-beam SNR / SINR / latency / packet loss / Doppler residual / elevation / handover state. Sourced from the 9 orbitops_* gauges in /metrics (see docs/contracts/metrics.md §3)."
      />

      <Stack spacing={2} sx={{ mb: 3 }}>
        {BEAMS_PAGE_CHARTS.map(({ metric, titleKey, unitKey }) => {
          const title = t(titleKey);
          const unit = t(unitKey);
          return (
            <Paper key={metric} sx={{ p: 3 }}>
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", display: "block", mb: 1 }}
              >
                {t("beams.chartCaption", {
                  title,
                  unit,
                  count: history.length,
                })}
              </Typography>
              <BeamMetricChart
                history={history}
                metric={metric}
                title={title}
                unit={unit}
              />
            </Paper>
          );
        })}
      </Stack>

      <Paper sx={{ p: 0, overflowX: "auto" }}>
        <Box
          component="table"
          sx={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
            "& th, & td": { px: 3, py: 1.4, textAlign: "left" },
            "& th": {
              bgcolor: "background.default",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "text.secondary",
              fontWeight: 600,
              borderBottom: "1px solid",
              borderColor: "divider",
            },
            "& tbody tr:hover": { bgcolor: "action.hover" },
            "& tbody td": { borderTop: "1px solid", borderColor: "divider" },
          }}
        >
          <thead>
            <tr>
              <th>Beam ID</th>
              <th>SNR</th>
              <th>SINR</th>
              <th>Latency</th>
              <th>Packet loss</th>
              <th>Doppler residual</th>
              <th>Elevation</th>
              <th>Handover</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {beams.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "48px 0", color: "#64748B" }}>
                  No beams. Load a scenario first.
                </td>
              </tr>
            )}
            {beams.map((b) => (
              <tr key={b.beam_id}>
                <td style={{ fontFamily: monoFamily, fontWeight: 600 }}>{b.beam_id}</td>
                <td>
                  <MetricNumber
                    value={b.snr_db}
                    unit="dB"
                    bold={b.health === "crit"}
                    color={
                      b.health === "crit"
                        ? "error.main"
                        : b.health === "warn"
                          ? "warning.main"
                          : undefined
                    }
                  />
                </td>
                <td><MetricNumber value={b.sinr_db} unit="dB" /></td>
                <td><MetricNumber value={b.latency_ms} precision={1} unit="ms" /></td>
                <td><MetricNumber value={b.packet_loss_ratio * 100} unit="%" /></td>
                <td><MetricNumber value={b.doppler_residual_hz} precision={0} unit="Hz" /></td>
                <td><MetricNumber value={b.elevation_deg} precision={1} unit="°" /></td>
                <td>
                  <Typography
                    component="span"
                    sx={{ fontFamily: monoFamily, fontSize: "0.75rem" }}
                  >
                    {/* Per docs/contracts/metrics.md §3:
                        0=stable, 1=preparing, 2=failure. */}
                    {["stable", "preparing", "failure"][b.handover_state] ?? `state=${b.handover_state}`}
                  </Typography>
                </td>
                <td><StatusChip status={b.health} /></td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Paper>
    </Box>
  );
}
