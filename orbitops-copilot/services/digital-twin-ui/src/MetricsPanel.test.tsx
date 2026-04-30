import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MetricsPanel } from "./MetricsPanel";
import { MOCK_METRICS } from "./mocks";

describe("MetricsPanel", () => {
  it("renders all required metric labels for each beam", () => {
    render(<MetricsPanel snapshot={MOCK_METRICS} />);
    for (const beam of MOCK_METRICS.beams) {
      const card = screen.getByTestId(`beam-card-${beam.beam_id}`);
      // Required labels per user prompt §2 Metrics Panel
      expect(within(card).getByText("SNR")).toBeInTheDocument();
      expect(within(card).getByText("SINR")).toBeInTheDocument();
      expect(within(card).getByText("Latency")).toBeInTheDocument();
      expect(within(card).getByText("Loss")).toBeInTheDocument();
      expect(within(card).getByText("Doppler residual")).toBeInTheDocument();
      expect(within(card).getByText(/handover:/)).toBeInTheDocument();
    }
  });

  it("formats critical beam SNR < 8 dB", () => {
    render(<MetricsPanel snapshot={MOCK_METRICS} />);
    const beam1 = screen.getByTestId("beam-card-beam-1");
    expect(beam1).toHaveTextContent("6.5 dB");
  });
});
