// Pure SVG view: ground station, satellite arc, 3 beams.
// Sprint 1 chooses SVG over CesiumJS/Three.js for demo stability + zero
// GPU/jsdom flakiness; CesiumJS upgrade lands in VS-13.

import type { MetricsSnapshot, BeamView } from "./types";

const HEALTH_FILL: Record<BeamView["health"], string> = {
  ok: "#10b981", // signal-ok
  warn: "#f59e0b",
  crit: "#ef4444",
};

interface Props {
  snapshot: MetricsSnapshot;
}

export function DigitalTwinView({ snapshot }: Props) {
  const { beams } = snapshot;
  // ground station: center bottom; satellite: arc apex; beams: fan from station to satellite zone
  const W = 600;
  const H = 320;
  const stationX = W / 2;
  const stationY = H - 30;
  const satY = 40;
  const satX = stationX + 80; // slight east
  const beamCount = beams.length;

  return (
    <section
      data-testid="digital-twin-view"
      aria-label="Digital twin view"
      className="rounded-2xl bg-space-800 p-4 ring-1 ring-white/5"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Digital twin view
      </h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Ground station at (${stationX}, ${stationY}), 1 satellite, ${beamCount} beams`}
        className="h-auto w-full"
      >
        {/* horizon line */}
        <line x1={0} y1={stationY} x2={W} y2={stationY} stroke="#1f2937" strokeWidth={1} />

        {/* satellite orbit arc (cosmetic) */}
        <path
          d={`M 40 ${satY + 20} Q ${W / 2} ${satY - 30} ${W - 40} ${satY + 20}`}
          fill="none"
          stroke="#334155"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* satellite */}
        <g data-testid="satellite">
          <circle cx={satX} cy={satY} r={10} fill="#3b82f6" />
          <text x={satX + 14} y={satY + 4} fill="#cbd5e1" fontSize={11}>
            b5g-1a
          </text>
        </g>

        {/* beams: fan lines + landing footprint circles */}
        {beams.map((b, i) => {
          const spread = 80;
          const offset = (i - (beamCount - 1) / 2) * spread;
          const targetX = stationX + offset;
          const targetY = stationY - 8;
          return (
            <g key={b.beam_id} data-testid={`beam-svg-${b.beam_id}`}>
              <line
                x1={satX}
                y1={satY + 8}
                x2={targetX}
                y2={targetY}
                stroke={HEALTH_FILL[b.health]}
                strokeWidth={b.health === "crit" ? 3 : 2}
                opacity={b.health === "crit" ? 1 : 0.55}
              />
              <circle
                cx={targetX}
                cy={targetY}
                r={10}
                fill={HEALTH_FILL[b.health]}
                fillOpacity={0.25}
                stroke={HEALTH_FILL[b.health]}
                strokeWidth={1.5}
              />
              <text
                x={targetX}
                y={targetY + 24}
                fill="#94a3b8"
                fontSize={10}
                textAnchor="middle"
              >
                {b.beam_id}
              </text>
            </g>
          );
        })}

        {/* ground station */}
        <g data-testid="ground-station">
          <polygon
            points={`${stationX - 14},${stationY} ${stationX + 14},${stationY} ${stationX},${stationY - 16}`}
            fill="#cbd5e1"
          />
          <text x={stationX} y={stationY + 18} fill="#cbd5e1" fontSize={11} textAnchor="middle">
            gs-tw-01
          </text>
        </g>
      </svg>
      <p className="mt-2 text-xs text-slate-500">
        SVG schematic (Sprint 1). CesiumJS satellite-pass animation lands in VS-13.
      </p>
    </section>
  );
}
