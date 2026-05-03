import {
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";

import type { BeamMetricKey } from "./BeamMetricChart";
import type { MetricsSnapshot } from "../types";

// Pure transform — exported for unit tests so the metric/beam-filter
// logic is testable without rendering Recharts (jsdom can't measure SVG).

interface SparklineRow {
  t: number;
  v: number;
}

export function beamSnapshotsToValues(
  history: MetricsSnapshot[],
  beamId: string,
  metric: BeamMetricKey,
): SparklineRow[] {
  const out: SparklineRow[] = [];
  for (const snap of history) {
    const beam = snap.beams.find((b) => b.beam_id === beamId);
    if (!beam) continue;
    const v = beam[metric] as number;
    out.push({ t: snap.t_seconds, v });
  }
  return out;
}

interface MetricSparklineProps {
  history: MetricsSnapshot[];
  beamId: string;
  metric: BeamMetricKey;
  /** Stroke color. Defaults to the orbitops theme primary so the sparkline
   * stays visually consistent with other charts (round-2 /review A3 fixed
   * the previous mismatched hardcoded `#0055ff`). */
  stroke?: string;
}

/**
 * Inline mini-chart for the Copilot evidence panel.
 *
 * Next to each metric citation, render a 60-px-tall line of the cited
 * (beam_id, metric) pair across the recent history window. The whole
 * point: viewer sees both the EXACT cited value AND its trajectory
 * without scrolling to the Beams page.
 *
 * No axes / legend / tooltip — sparkline aesthetic. Empty data renders
 * nothing (the citation list above already conveys "no data" via empty
 * list); a placeholder would just be visual noise.
 *
 * `isAnimationActive={false}` keeps test snapshot timing deterministic.
 */
export default function MetricSparkline({
  history,
  beamId,
  metric,
  // Theme palette primary.main; matches BeamMetricChart's first line color.
  // Round-2 /review A3: was `#0055ff` (mismatched K8s blue).
  stroke = "#326CE5",
}: MetricSparklineProps) {
  const data = beamSnapshotsToValues(history, beamId, metric);

  // Recharts LineChart needs ≥ 2 points to render a visible line segment;
  // a 1-point chart shows an invisible single vertex which user reads as
  // "chart broken". Render nothing until we can actually convey trend
  // (round-2 /review C2).
  if (data.length < 2) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        {/* YAxis hidden but kept so Recharts auto-scales the line shape
            against the actual data range; without it the line clips at
            the container edges when values cluster tightly. */}
        <YAxis hide domain={["auto", "auto"]} />
        <Line
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
