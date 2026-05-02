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

import type { MetricsSnapshot } from "../types";

// Pure transforms — kept exported so tests can hit them without
// rendering Recharts (jsdom can't measure SVG layout, so chart-component
// tests carry overhead).

interface ChartRow {
  t: number;
  [beamId: string]: number;
}

export function snapshotsToChartData(history: MetricsSnapshot[]): ChartRow[] {
  return history.map((snap) => {
    const row: ChartRow = { t: snap.t_seconds };
    for (const b of snap.beams) {
      row[b.beam_id] = b.snr_db;
    }
    return row;
  });
}

export function beamIdsFromHistory(history: MetricsSnapshot[]): string[] {
  if (history.length === 0) return [];
  // Use the LATEST snapshot's beam set (not a union across history).
  // Reason: scenario reload mid-poll changes the beam set; rendering a
  // Line for a beam that no longer exists draws a ghost-flatline that
  // confuses operators reading the chart.
  return history[history.length - 1].beams.map((b) => b.beam_id);
}

// Per-line stroke colors. Keep within the design system's primary +
// 4 secondary accents; cycle if a scenario somehow has more beams.
const LINE_COLORS = ["#0055ff", "#00b894", "#fdcb6e", "#ff7675", "#a29bfe"];

interface BeamSnrChartProps {
  history: MetricsSnapshot[];
}

/**
 * Recharts LineChart of per-beam SNR over time.
 *
 * One Line per beam_id; X = `t_seconds` from the snapshot; Y = `snr_db`.
 * Empty history renders a placeholder rather than an empty axis frame —
 * during the first 5 s after page load the parent has 0 snapshots, and
 * an empty chart looks like a bug.
 *
 * `isAnimationActive={false}` keeps tests deterministic (Recharts'
 * default 1500 ms tween fights vitest's snapshot timing).
 */
export default function BeamSnrChart({ history }: BeamSnrChartProps) {
  const data = snapshotsToChartData(history);
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
          No history yet — wait for the next /metrics scrape (5 s cadence).
        </Typography>
      </Box>
    );
  }

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
          label={{ value: "SNR (dB)", angle: -90, position: "insideLeft" }}
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
