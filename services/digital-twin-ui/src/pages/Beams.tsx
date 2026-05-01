import { Box, Paper, Typography } from "@mui/material";

import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import MetricNumber from "../components/MetricNumber";
import { monoFamily } from "../theme";
import type { MetricsSnapshot } from "../types";

interface BeamsProps {
  data: MetricsSnapshot | null;
}

export default function Beams({ data }: BeamsProps) {
  const beams = data?.beams ?? [];
  return (
    <Box>
      <SectionHeader
        category="Workloads"
        title="Beams"
        subtitle="Per-beam SNR / latency / packet loss / Doppler / handover state. Sourced from orbitops_beam_*  gauges in /metrics."
      />

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
              <th>Handover</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {beams.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 0", color: "#64748B" }}>
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
