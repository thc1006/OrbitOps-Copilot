/**
 * VS-9b.2 — sliding-window history of MetricsSnapshot.
 *
 * Pure window hook: takes the latest snapshot from useMetricsPoll and
 * accumulates it into a bounded array. Tested with renderHook so the
 * snapshot-flow contract is locked-in independent of any chart consumer.
 *
 * Design note: dedup was considered (skip when latest.scraped_at matches
 * tail) but rejected — useMetricsPoll returns a new `data` object only
 * when fetch resolves, so prop reference equality is the natural dedup.
 * Tests below verify both branches: same-ref no-op rerenders DON'T grow
 * the history.
 */
import { describe, expect, test } from "vitest";
import { StrictMode, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";

import { useMetricsHistory } from "./useMetricsHistory";
import type { MetricsSnapshot } from "../types";

const snap = (t: number, snrPerBeam: Record<string, number>): MetricsSnapshot => ({
  scenario_id: "test",
  t_seconds: t,
  beams: Object.entries(snrPerBeam).map(([beam_id, snr_db]) => ({
    beam_id,
    snr_db,
    sinr_db: snr_db - 2,
    latency_ms: 25,
    packet_loss_ratio: 0,
    doppler_residual_hz: 0,
    handover_state: 0,
    elevation_deg: 55,
    health: "ok" as const,
  })),
  gateways: [],
  active_anomaly: null,
  active_anomalies: [],
  scraped_at: new Date(2026, 4, 2, 0, 0, t).toISOString(),
});

describe("useMetricsHistory", () => {
  test("starts empty", () => {
    const { result } = renderHook(() => useMetricsHistory(null));
    expect(result.current).toEqual([]);
  });

  test("accumulates snapshots in order", () => {
    const s1 = snap(0, { "beam-1": 12 });
    const s2 = snap(5, { "beam-1": 11 });
    const s3 = snap(10, { "beam-1": 10 });
    const { result, rerender } = renderHook(
      ({ latest }: { latest: MetricsSnapshot | null }) =>
        useMetricsHistory(latest),
      { initialProps: { latest: s1 } },
    );
    expect(result.current).toHaveLength(1);

    rerender({ latest: s2 });
    rerender({ latest: s3 });
    expect(result.current).toHaveLength(3);
    expect(result.current.map((s) => s.t_seconds)).toEqual([0, 5, 10]);
  });

  test("trims to maxSize when buffer overflows (oldest dropped)", () => {
    const { result, rerender } = renderHook(
      ({ latest }: { latest: MetricsSnapshot | null }) =>
        useMetricsHistory(latest, 3),
      { initialProps: { latest: snap(0, { "beam-1": 12 }) } },
    );
    rerender({ latest: snap(5, { "beam-1": 11 }) });
    rerender({ latest: snap(10, { "beam-1": 10 }) });
    rerender({ latest: snap(15, { "beam-1": 9 }) });

    expect(result.current).toHaveLength(3);
    // Oldest (t=0) dropped; window holds [5, 10, 15].
    expect(result.current.map((s) => s.t_seconds)).toEqual([5, 10, 15]);
  });

  test("null latest is ignored (doesn't push null into history)", () => {
    const s1 = snap(0, { "beam-1": 12 });
    const { result, rerender } = renderHook(
      ({ latest }: { latest: MetricsSnapshot | null }) =>
        useMetricsHistory(latest),
      // Cast widens the inferred type so subsequent rerender({ latest: s1 })
      // type-checks against MetricsSnapshot, not just null.
      { initialProps: { latest: null as MetricsSnapshot | null } },
    );
    expect(result.current).toEqual([]);

    rerender({ latest: s1 });
    expect(result.current).toHaveLength(1);

    // Polling glitch: fetch error sets data back to null; previous
    // history must be preserved (else a transient blip wipes the chart).
    rerender({ latest: null });
    expect(result.current).toHaveLength(1);
  });

  test("no-op rerender with same latest reference doesn't grow history", () => {
    const s1 = snap(0, { "beam-1": 12 });
    const { result, rerender } = renderHook(
      ({ latest }: { latest: MetricsSnapshot | null }) =>
        useMetricsHistory(latest),
      { initialProps: { latest: s1 } },
    );
    expect(result.current).toHaveLength(1);

    // React parents may re-render for unrelated state changes while the
    // poll's `data` reference is stable. The history must not grow on
    // those — only on actual new snapshots.
    rerender({ latest: s1 });
    rerender({ latest: s1 });
    expect(result.current).toHaveLength(1);
  });

  // ─── self-/review: StrictMode dev double-mount ─────────────────────
  // main.tsx wraps the app in <StrictMode>, which deliberately runs
  // every effect's setup-cleanup-setup cycle twice on mount in dev. Without
  // a reference-equality dedup, our useEffect's setHistory(=> [...h, latest])
  // fires twice on first mount, leaving the same snapshot in history twice.
  // Production builds skip the second cycle, so the bug is dev-only — but
  // dev is where we develop, so the chart would visually show duplicate
  // first-tick on every page load. Lock the fix in here.
  test("StrictMode double-mount does NOT double-push the first snapshot", () => {
    const s1 = snap(0, { "beam-1": 12 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(() => useMetricsHistory(s1), { wrapper });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBe(s1);
  });

  // ─── round-2 deep /review: maxSize=0 edge case ─────────────────────
  // Original guard was `next.length > maxSize ? slice(-maxSize) : next`.
  // For maxSize=0: length always > 0, AND JS treats `slice(-0)` as
  // `slice(0)` which returns the FULL array — so the history would grow
  // unbounded (memory leak). Defensive: maxSize<=0 means "keep zero".
  test("maxSize=0 keeps history empty regardless of snapshot count", () => {
    const { result, rerender } = renderHook(
      ({ latest }: { latest: MetricsSnapshot | null }) =>
        useMetricsHistory(latest, 0),
      {
        initialProps: {
          latest: snap(0, { "beam-1": 12 }) as MetricsSnapshot | null,
        },
      },
    );
    expect(result.current).toEqual([]);

    rerender({ latest: snap(5, { "beam-1": 11 }) });
    rerender({ latest: snap(10, { "beam-1": 10 }) });
    expect(result.current).toEqual([]);
  });
});
