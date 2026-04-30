import type { MetricsSnapshot, BeamView } from "./types";

const HEALTH_BG: Record<BeamView["health"], string> = {
  ok: "bg-signal-ok/20 ring-signal-ok/40",
  warn: "bg-signal-warn/20 ring-signal-warn/40",
  crit: "bg-signal-crit/20 ring-signal-crit/40",
};
const HEALTH_DOT: Record<BeamView["health"], string> = {
  ok: "bg-signal-ok",
  warn: "bg-signal-warn",
  crit: "bg-signal-crit",
};
const HO_LABEL = ["stable", "preparing", "failure"] as const;

function fmt(n: number, digits = 1) {
  return n.toFixed(digits);
}

interface Props {
  snapshot: MetricsSnapshot;
}

export function MetricsPanel({ snapshot }: Props) {
  return (
    <section
      data-testid="metrics-panel"
      aria-label="Metrics panel"
      className="flex flex-col gap-3 rounded-2xl bg-space-800 p-4 ring-1 ring-white/5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Beam metrics
      </h2>
      <div className="flex flex-col gap-2">
        {snapshot.beams.map((b) => (
          <article
            key={b.beam_id}
            data-testid={`beam-card-${b.beam_id}`}
            className={`rounded-xl p-3 ring-1 ${HEALTH_BG[b.health]}`}
          >
            <header className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_DOT[b.health]}`}
                  aria-hidden
                />
                <span className="font-mono text-sm font-semibold">{b.beam_id}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                handover: {HO_LABEL[b.handover_state]}
              </span>
            </header>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-400">SNR</dt>
                <dd className="font-mono">{fmt(b.snr_db)} dB</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">SINR</dt>
                <dd className="font-mono">{fmt(b.sinr_db)} dB</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Latency</dt>
                <dd className="font-mono">{fmt(b.latency_ms, 0)} ms</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Loss</dt>
                <dd className="font-mono">{fmt(b.packet_loss_ratio * 100, 2)}%</dd>
              </div>
              <div className="col-span-2 flex justify-between">
                <dt className="text-slate-400">Doppler residual</dt>
                <dd className="font-mono">{fmt(b.doppler_residual_hz, 0)} Hz</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
