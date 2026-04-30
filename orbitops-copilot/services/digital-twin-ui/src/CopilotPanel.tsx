import { useState } from "react";
import { askCopilot } from "./api";
import type { CopilotResponse } from "./types";

interface Props {
  onAsk?: (q: string) => Promise<CopilotResponse>;
  initialResponse?: CopilotResponse;
  scenarioId?: string;
}

export function CopilotPanel({ onAsk, initialResponse, scenarioId }: Props) {
  const ask = onAsk ?? ((q: string) => askCopilot({ question: q, scenario_id: scenarioId }));
  const [question, setQuestion] = useState("Which beam is degrading and why?");
  const [response, setResponse] = useState<CopilotResponse | null>(initialResponse ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    setLoading(true);
    setError(null);
    try {
      const r = await ask(question);
      setResponse(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      data-testid="copilot-panel"
      aria-label="Copilot panel"
      className="flex flex-col gap-3 rounded-2xl bg-space-800 p-4 ring-1 ring-white/5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Copilot
      </h2>
      <div className="flex gap-2">
        <input
          aria-label="Copilot question"
          data-testid="copilot-input"
          className="flex-1 rounded-md bg-space-900 px-3 py-2 font-mono text-sm ring-1 ring-white/10 focus:outline-none focus:ring-signal-info"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAsk();
          }}
        />
        <button
          type="button"
          data-testid="copilot-submit"
          onClick={() => void handleAsk()}
          disabled={loading}
          className="rounded-md bg-signal-info px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </div>

      {error && (
        <p data-testid="copilot-error" className="text-sm text-signal-crit">
          {error}
        </p>
      )}

      {response === null && !loading && (
        <p data-testid="copilot-empty" className="text-sm text-slate-400">
          No question asked yet. Try: <em>Which beam is degrading and why?</em>
        </p>
      )}

      {response && <CopilotResponseView response={response} />}
    </section>
  );
}

function CopilotResponseView({ response }: { response: CopilotResponse }) {
  if (response.status === "REFUSED") {
    return (
      <div data-testid="copilot-refused" className="rounded-md bg-signal-warn/10 p-3 ring-1 ring-signal-warn/30">
        <p className="font-semibold text-signal-warn">Refused</p>
        <p className="mt-1 text-sm text-slate-300">{response.refusal_reason}</p>
      </div>
    );
  }
  if (response.status === "INSUFFICIENT_EVIDENCE") {
    return (
      <div data-testid="copilot-insufficient" className="rounded-md bg-signal-info/10 p-3 ring-1 ring-signal-info/30">
        <p className="font-semibold text-signal-info">Insufficient evidence</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {response.unknowns.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (response.status === "ERROR") {
    return (
      <div data-testid="copilot-error-status" className="rounded-md bg-signal-crit/10 p-3 ring-1 ring-signal-crit/30">
        <p className="font-semibold text-signal-crit">Error</p>
        <p className="mt-1 text-sm text-slate-300">{response.error}</p>
      </div>
    );
  }

  // status === "ok"
  return (
    <div data-testid="copilot-ok" className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-100">{response.summary}</p>
        <p className="mt-1 text-xs text-slate-400">{response.likely_cause}</p>
      </div>

      <details
        data-testid="copilot-actions"
        className="rounded-md bg-space-900 p-3 ring-1 ring-white/5"
        open
      >
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recommended actions ({response.recommended_actions.length})
        </summary>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {response.recommended_actions.map((a) => (
            <li key={a.step}>
              <span className="font-semibold">{a.title}</span>
              <p className="text-xs text-slate-400">{a.body}</p>
            </li>
          ))}
        </ol>
      </details>

      <details
        data-testid="copilot-evidence"
        className="rounded-md bg-space-900 p-3 ring-1 ring-white/5"
      >
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400">
          Evidence ({response.evidence.metrics_used.length} metrics, {response.evidence.logs_used.length} logs)
        </summary>
        <ul className="mt-2 space-y-1 text-xs">
          {response.evidence.metrics_used.map((m, i) => (
            <li key={i} className="font-mono text-slate-300">
              {m.name}
              {Object.keys(m.labels).length
                ? `{${Object.entries(m.labels)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(",")}}`
                : ""}{" "}
              = {m.value}
            </li>
          ))}
        </ul>
      </details>

      <p className="text-xs text-slate-500">
        Confidence: {(response.confidence * 100).toFixed(0)}% ·{" "}
        {response.unknowns.length} unknowns
      </p>

      {response.risk_if_ignored && (
        <p className="rounded-md bg-signal-crit/5 p-2 text-xs text-signal-crit ring-1 ring-signal-crit/20">
          Risk if ignored: {response.risk_if_ignored}
        </p>
      )}
    </div>
  );
}
