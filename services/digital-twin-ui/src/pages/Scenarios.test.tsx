/**
 * VS-8 full — UI "Ready for Copilot" affordance.
 *
 * Closes the UX nit identified in PR #38 demo-path audit:
 * a fresh UI session at default `t=0` lets a RunSpace evaluator
 * ask Copilot before the scenario has progressed into the
 * anomaly window — they see INSUFFICIENT_EVIDENCE and assume
 * the Copilot is broken. The 4-step click flow documented in
 * PR #41 reduces the risk to a discipline issue; this PR makes
 * it a one-click affordance.
 *
 * Per CLAUDE.md §12.2: this RED test must precede the GREEN impl
 * commit in git history.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";

import Scenarios from "./Scenarios";
import { orbitopsTheme } from "../theme";
import * as api from "../api";

const refetchMetrics = vi.fn();

const wrap = () => (
  <ThemeProvider theme={orbitopsTheme}>
    <Scenarios refetchMetrics={refetchMetrics} />
  </ThemeProvider>
);

beforeEach(() => {
  refetchMetrics.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Scenarios — Ready for Copilot affordance", () => {
  test("button is visible on initial render", () => {
    render(wrap());
    // Match by accessible name; exact wording is up to the impl, but it
    // must contain "Ready for Copilot" so an evaluator searching the page
    // can find it.
    const btn = screen.getByRole("button", { name: /ready for copilot/i });
    expect(btn).toBeTruthy();
  });

  test("clicking it calls loadScenario then tickScenario(90)", async () => {
    const loadSpy = vi
      .spyOn(api, "loadScenario")
      .mockResolvedValue({
        loaded: "beam-degradation-001",
        t: 0,
        beams: 3,
        gateways: 1,
      });
    const tickSpy = vi
      .spyOn(api, "tickScenario")
      .mockResolvedValue({
        t: 90,
        active_anomalies: ["snr_drop"],
      });

    render(wrap());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ready for copilot/i }));

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(1);
      // tickScenario must be called with exactly 90s — that lands the
      // beam-degradation scenario inside its snr_drop window (t=60..150).
      expect(tickSpy).toHaveBeenCalledWith(90);
    });
  });

  test("after success it shows 'Ready for Copilot' status and lists snr_drop active", async () => {
    vi.spyOn(api, "loadScenario").mockResolvedValue({
      loaded: "beam-degradation-001",
      t: 0,
      beams: 3,
      gateways: 1,
    });
    vi.spyOn(api, "tickScenario").mockResolvedValue({
      t: 90,
      active_anomalies: ["snr_drop"],
    });

    render(wrap());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ready for copilot/i }));

    // Expect a success-style alert mentioning the new state, including
    // the active anomaly so the demo presenter sees it's "armed".
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/snr_drop/i);
      // Either "ready" or "t = 90" or both — some signal that the
      // emulator is now at the anomaly-active state.
      expect(alert.textContent).toMatch(/ready|t\s*=\s*90/i);
    });
  });

  test("on load failure, surfaces error in the alert (does NOT call tick)", async () => {
    vi.spyOn(api, "loadScenario").mockRejectedValue(new Error("network down"));
    const tickSpy = vi.spyOn(api, "tickScenario");

    render(wrap());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ready for copilot/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/network down/i);
    });
    expect(tickSpy).not.toHaveBeenCalled();
  });
});
