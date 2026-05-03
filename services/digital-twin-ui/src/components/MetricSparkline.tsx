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
  /** Stroke color; defaults to a subdued primary so the sparkline doesn't
   * compete with the citation text it sits next to. */
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
  stroke = "#0055ff",
}: MetricSparklineProps) {
  const data = beamSnapshotsToValues(history, beamId, metric);

  if (data.length === 0) {
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
