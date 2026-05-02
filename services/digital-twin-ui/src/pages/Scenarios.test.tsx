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

  test("clicking it calls loadScenario then tickScenario(90), in that order", async () => {
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

    // PR #42 review (Copilot bot): pin the SEQUENCING contract — load
    // must complete before tick. Without this, a future parallel/
    // out-of-order impl would still pass the call-count assertions but
    // would race the emulator's state machine.
    expect(loadSpy.mock.invocationCallOrder[0]).toBeLessThan(
      tickSpy.mock.invocationCallOrder[0],
    );
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

  // PR #45 bot #45-3: H.1.3 added 3 presets; pin that the 2 new buttons
  // (handover-failure + gateway-fallback) actually call loadScenario with
  // the correct preset body. Without this, a future regression in the
  // SCENARIO_PRESETS array (e.g. mis-mapped preset.body) would silently
  // load the wrong scenario.

  test("clicking 'Load handover-failure' calls loadScenario with that preset", async () => {
    const loadSpy = vi.spyOn(api, "loadScenario").mockResolvedValue({
      loaded: "handover-failure-001",
      t: 0,
      beams: 3,
      gateways: 1,
    });
    render(wrap());
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /load handover-failure/i }),
    );

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
    const passedBody = loadSpy.mock.calls[0][0] as { scenario_id?: string };
    expect(passedBody.scenario_id).toBe("handover-failure-001");
  });

  test("clicking 'Load gateway-fallback' calls loadScenario with that preset", async () => {
    const loadSpy = vi.spyOn(api, "loadScenario").mockResolvedValue({
      loaded: "gateway-fallback-001",
      t: 0,
      beams: 3,
      gateways: 1,
    });
    render(wrap());
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /load gateway-fallback/i }),
    );

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
    const passedBody = loadSpy.mock.calls[0][0] as { scenario_id?: string };
    expect(passedBody.scenario_id).toBe("gateway-fallback-001");
  });

  test("on tick failure AFTER load succeeds, error mentions partial state (loaded, t=0)", async () => {
    // PR #42 review (Copilot bot, round 2): split try/catch contract.
    // If load succeeds but tick fails, the emulator is in a partial state
    // (loaded, t=0). The error message must (a) NOT pretend nothing
    // happened, and (b) tell the user how to recover.
    vi.spyOn(api, "loadScenario").mockResolvedValue({
      loaded: "beam-degradation-001",
      t: 0,
      beams: 3,
      gateways: 1,
    });
    vi.spyOn(api, "tickScenario").mockRejectedValue(new Error("tick HTTP 503"));

    render(wrap());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ready for copilot/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      // Error message must reference the loaded state explicitly.
      expect(alert.textContent).toMatch(/beam-degradation-001/);
      // Must mention t=0 so the user knows tick didn't run.
      expect(alert.textContent).toMatch(/t=0/);
      // Must surface the actual underlying error.
      expect(alert.textContent).toMatch(/tick HTTP 503/);
    });
    // refetchMetrics must have been called once (after the successful
    // load) so the UI doesn't show stale data — even though the tick
    // ultimately failed.
    expect(refetchMetrics).toHaveBeenCalled();
  });

  test("when tick returns NO active anomalies, alert is a warning that mentions INSUFFICIENT_EVIDENCE", async () => {
    // PR #42 review (Copilot bot): an empty `active_anomalies` after the
    // tick means we did NOT actually land in the anomaly window. Reporting
    // "Ready for Copilot" in that state would be misleading. Pin the
    // contract: severity=warning + explicit INSUFFICIENT_EVIDENCE warning.
    vi.spyOn(api, "loadScenario").mockResolvedValue({
      loaded: "beam-degradation-001",
      t: 0,
      beams: 3,
      gateways: 1,
    });
    vi.spyOn(api, "tickScenario").mockResolvedValue({
      t: 90,
      active_anomalies: [], // scenario shifted, or constant fell outside window
    });

    render(wrap());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ready for copilot/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      // MUI severity="warning" maps to .MuiAlert-standardWarning className.
      expect(alert.className).toMatch(/Warning/);
      expect(alert.textContent).toMatch(/INSUFFICIENT_EVIDENCE/);
      // Must NOT pretend it's ready.
      expect(alert.textContent).not.toMatch(/Ready for Copilot/);
    });
  });
});
