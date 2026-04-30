import type { MetricsSnapshot } from "./types";

export function AnomalyBanner({ snapshot }: { snapshot: MetricsSnapshot }) {
  if (!snapshot.active_anomaly) return null;
  return (
    <div
      role="alert"
      data-testid="anomaly-banner"
      className="rounded-xl bg-signal-crit/15 p-3 ring-1 ring-signal-crit/40"
    >
      <p className="text-sm font-semibold text-signal-crit">
        Active anomaly: <span className="font-mono">{snapshot.active_anomaly}</span>{" "}
        <span className="text-slate-300">at t = {snapshot.t_seconds}s</span>
      </p>
    </div>
  );
}
