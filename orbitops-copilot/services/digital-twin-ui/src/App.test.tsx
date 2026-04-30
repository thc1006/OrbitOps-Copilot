import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { MOCK_METRICS } from "./mocks";
import type { MetricsSnapshot } from "./types";

describe("App layout", () => {
  it("renders three panels: digital-twin, metrics, copilot", () => {
    render(<App />);
    expect(screen.getByTestId("digital-twin-view")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-panel")).toBeInTheDocument();
    expect(screen.getByTestId("copilot-panel")).toBeInTheDocument();
  });

  it("renders anomaly banner when active_anomaly is set", () => {
    render(<App />);
    const banner = screen.getByTestId("anomaly-banner");
    expect(banner).toHaveTextContent("snr_drop");
    expect(banner).toHaveAttribute("role", "alert");
  });

  it("hides anomaly banner when no active anomaly", () => {
    const calm: MetricsSnapshot = { ...MOCK_METRICS, active_anomaly: null };
    render(<App initialSnapshot={calm} />);
    expect(screen.queryByTestId("anomaly-banner")).not.toBeInTheDocument();
  });

  it("renders one beam card per beam in the snapshot", () => {
    render(<App />);
    for (const beam of MOCK_METRICS.beams) {
      expect(screen.getByTestId(`beam-card-${beam.beam_id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`beam-svg-${beam.beam_id}`)).toBeInTheDocument();
    }
  });
});
