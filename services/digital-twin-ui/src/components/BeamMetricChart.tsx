import { Box, Typography } from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BeamView, MetricsSnapshot } from "../types";

// Pure transforms — exported so tests hit them without rendering Recharts.
//
// Generalized over BeamMetricKey (replaces the SNR-only helpers from
// the previous BeamSnrChart). Other chart components — sparklines on
// Copilot, latency / doppler / packet-loss panels — share these.

export type BeamMetricKey = Extract<
  keyof BeamView,
  | "snr_db"
  | "sinr_db"
  | "latency_ms"
  | "packet_loss_ratio"
  | "doppler_residual_hz"
  | "elevation_deg"
>;

interface ChartRow {
  t: number;
  [beamId: string]: number;
}

export function snapshotsToChartData(
  history: MetricsSnapshot[],
  metric: BeamMetricKey,
): ChartRow[] {
  return history.map((snap) => {
    const row: ChartRow = { t: snap.t_seconds };
    for (const b of snap.beams) {
      row[b.beam_id] = b[metric] as number;
    }
    return row;
  });
}

export function beamIdsFromHistory(history: MetricsSnapshot[]): string[] {
  if (history.length === 0) return [];
  // LATEST snapshot's beam set (not union). Reason: scenario reload
  // mid-poll changes the beam set; rendering a Line for a beam that
  // no longer exists draws a ghost-flatline that confuses operators.
  return history[history.length - 1].beams.map((b) => b.beam_id);
}

const LINE_COLORS = ["#0055ff", "#00b894", "#fdcb6e", "#ff7675", "#a29bfe"];

interface BeamMetricChartProps {
  history: MetricsSnapshot[];
  metric: BeamMetricKey;
  title: string;
  unit: string;
}

/**
 * Recharts time-series of one BeamView field per beam_id.
 *
 * Generalized from the SNR-only BeamSnrChart. Each chart instance picks
 * its own metric (snr_db / latency_ms / doppler_residual_hz / …) and
 * supplies a title + unit for axis labels and the empty-history hint.
 *
 * `isAnimationActive={false}` keeps test snapshot timing deterministic
 * (Recharts' default 1500 ms tween fights vitest assertions).
 */
export default function BeamMetricChart({
  history,
  metric,
  title,
  unit,
}: BeamMetricChartProps) {
  const data = snapshotsToChartData(history, metric);
  const beamIds = beamIdsFromHistory(history);

  if (data.length === 0) {
    return (
      <Box
        sx={{
          minHeight: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {title}: no history yet — wait for the next /metrics scrape (5 s cadence).
        </Typography>
      </Box>
    );
  }

  const yLabel = `${title} (${unit})`;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v: number) => `${v}s`}
        />
        <YAxis
          label={{ value: yLabel, angle: -90, position: "insideLeft" }}
          domain={["auto", "auto"]}
        />
        <Tooltip />
        <Legend />
        {beamIds.map((id, i) => (
          <Line
            key={id}
            type="monotone"
            dataKey={id}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
