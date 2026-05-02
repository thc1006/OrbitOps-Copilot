import { useEffect, useState } from "react";
import type { MetricsSnapshot } from "../types";

/**
 * Sliding-window history of MetricsSnapshot.
 *
 * Pure window: callers pass the latest snapshot from useMetricsPoll
 * (or any source) and the hook accumulates it into a bounded array.
 * Defaults to 60 entries; at the 5s scrape cadence that's a 5-minute
 * trailing window — long enough for the demo's beam-degradation event
 * (90 s) plus a baseline shoulder, short enough to keep DOM cheap.
 *
 * Design notes:
 *
 *  - **Dedup is by reference equality.** useMetricsPoll returns a NEW
 *    `data` object only when fetch resolves; rerenders driven by other
 *    state (e.g. AppBar resize) keep `data` reference-stable. Adding a
 *    scraped_at-comparison dedup would be belt-and-braces but isn't
 *    needed and would add cost on every push.
 *
 *  - **Null latest is ignored.** A transient fetch error (parsed as
 *    `data: null` upstream) must NOT wipe the existing history — the
 *    chart should keep showing the last good window across blips.
 *
 *  - **No timestamp normalization.** Caller is responsible for ensuring
 *    snapshots arrive in monotonic order. useMetricsPoll guarantees
 *    that via its own out-of-order-drop logic (myTick !== tickRef).
 */
export function useMetricsHistory(
  latest: MetricsSnapshot | null,
  maxSize = 60,
): MetricsSnapshot[] {
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);

  useEffect(() => {
    if (!latest) return;
    setHistory((h) => {
      // Reference-equality dedup at the head — covers two cases:
      //   1. StrictMode dev double-mount fires this effect twice with
      //      the same `latest` → without dedup, history gains the same
      //      snapshot twice on first mount.
      //   2. Defensive: any future effect that re-fires for the same
      //      reference (e.g. parent re-creating wrapper objects).
      // Production polling never hits this path because useMetricsPoll
      // produces a new `data` object on each fetch resolve.
      if (h.length > 0 && h[h.length - 1] === latest) return h;
      const next = [...h, latest];
      return next.length > maxSize ? next.slice(-maxSize) : next;
    });
  }, [latest, maxSize]);

  return history;
}
