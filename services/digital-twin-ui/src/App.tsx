import { AnomalyBanner } from "./AnomalyBanner";
import { CopilotPanel } from "./CopilotPanel";
import { DigitalTwinView } from "./DigitalTwinView";
import { MetricsPanel } from "./MetricsPanel";
import { MOCK_METRICS } from "./mocks";
import type { MetricsSnapshot } from "./types";

interface AppProps {
  initialSnapshot?: MetricsSnapshot;
}

export function App({ initialSnapshot = MOCK_METRICS }: AppProps) {
  return (
    <main className="min-h-screen bg-space-900 px-4 py-6 lg:px-8">
      <header className="mx-auto mb-6 max-w-7xl">
        <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
          OrbitOps Copilot
        </h1>
        <p className="text-xs text-slate-400">
          B5G LEO ground-station operations digital twin · Sprint 1 demo
        </p>
      </header>

      <div className="mx-auto mb-4 max-w-7xl">
        <AnomalyBanner snapshot={initialSnapshot} />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <DigitalTwinView snapshot={initialSnapshot} />
        <MetricsPanel snapshot={initialSnapshot} />
        <CopilotPanel scenarioId={initialSnapshot.scenario_id} />
      </div>
    </main>
  );
}
