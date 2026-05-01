import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMetricsSnapshot } from "../api";
import type { MetricsSnapshot } from "../types";

interface PollState {
  data: MetricsSnapshot | null;
  error: Error | null;
  isLoading: boolean;
  lastFetched: number | null;
}

/**
 * Poll the emulator's /metrics + /scenario/current pair on a fixed cadence.
 * Defaults to 5 seconds — matches Prometheus's scrape_interval so the UI
 * doesn't refresh faster than the underlying source.
 *
 * Returns immediate fetch + interval. `refetch()` triggers an extra
 * out-of-band fetch (button-driven). All in-flight fetches abort on
 * unmount or when interval changes.
 */
export function useMetricsPoll(
  intervalMs = 5_000,
): PollState & { refetch: () => void } {
  const [state, setState] = useState<PollState>({
    data: null,
    error: null,
    isLoading: true,
    lastFetched: null,
  });

  // Monotonic counter — every tick gets a unique id so a slow earlier
  // request that resolves after a newer one is dropped on the floor.
  const tickRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Set to true when the hook unmounts. Both the in-flight `tick` and any
  // pending setState must check this to avoid setState-after-unmount.
  const cancelledRef = useRef(false);

  // Stable function reference so the effect can also use it AND we can
  // hand it back to the caller as `refetch`. Empty dep array — `setState`
  // is a stable React setter, so no need to list it.
  const tick = useCallback(async () => {
    tickRef.current += 1;
    const myTick = tickRef.current;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState((s) => ({ ...s, isLoading: true }));
    try {
      const snap = await fetchMetricsSnapshot(ac.signal);
      if (cancelledRef.current || tickRef.current !== myTick) return;
      setState({
        data: snap,
        error: null,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      if (cancelledRef.current || tickRef.current !== myTick) return;
      const e = err as Error;
      if (e.name === "AbortError") return;
      setState((s) => ({ ...s, error: e, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(id);
      abortRef.current?.abort();
    };
  }, [intervalMs, tick]);

  return { ...state, refetch: tick };
}
