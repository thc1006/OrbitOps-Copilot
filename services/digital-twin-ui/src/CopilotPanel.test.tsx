import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopilotPanel } from "./CopilotPanel";
import {
  MOCK_COPILOT_OK,
  MOCK_COPILOT_REFUSED,
  MOCK_COPILOT_INSUFFICIENT,
} from "./mocks";

describe("CopilotPanel", () => {
  it("shows empty state when no question yet asked", () => {
    render(<CopilotPanel onAsk={vi.fn()} />);
    expect(screen.getByTestId("copilot-empty")).toBeInTheDocument();
  });

  it("renders a grounded ok response with evidence + actions", async () => {
    const onAsk = vi.fn().mockResolvedValue(MOCK_COPILOT_OK);
    const user = userEvent.setup();
    render(<CopilotPanel onAsk={onAsk} />);

    await user.click(screen.getByTestId("copilot-submit"));
    expect(await screen.findByTestId("copilot-ok")).toBeInTheDocument();

    // Summary mentions beam-1 (AC-001 §Then 1 verbatim chain)
    expect(screen.getByTestId("copilot-ok")).toHaveTextContent("beam-1");

    // Evidence: at least one orbitops_beam_snr_db citation
    const evidence = screen.getByTestId("copilot-evidence");
    expect(evidence).toHaveTextContent("orbitops_beam_snr_db");

    // Recommended actions: at least 1
    const actions = screen.getByTestId("copilot-actions");
    expect(actions).toHaveTextContent("Trigger handover");
  });

  it("renders refused state with refusal_reason", async () => {
    const onAsk = vi.fn().mockResolvedValue(MOCK_COPILOT_REFUSED);
    const user = userEvent.setup();
    render(<CopilotPanel onAsk={onAsk} />);
    await user.click(screen.getByTestId("copilot-submit"));
    expect(await screen.findByTestId("copilot-refused")).toBeInTheDocument();
  });

  it("renders insufficient state with unknowns", async () => {
    const onAsk = vi.fn().mockResolvedValue(MOCK_COPILOT_INSUFFICIENT);
    const user = userEvent.setup();
    render(<CopilotPanel onAsk={onAsk} />);
    await user.click(screen.getByTestId("copilot-submit"));
    const insufficient = await screen.findByTestId("copilot-insufficient");
    expect(insufficient).toHaveTextContent(/no metrics or logs were retrieved/i);
  });

  it("supports Enter-to-submit on the question input", async () => {
    const onAsk = vi.fn().mockResolvedValue(MOCK_COPILOT_OK);
    const user = userEvent.setup();
    render(<CopilotPanel onAsk={onAsk} />);
    const input = screen.getByTestId("copilot-input");
    await user.click(input);
    await user.keyboard("{Enter}");
    expect(onAsk).toHaveBeenCalledTimes(1);
  });
});
