// VS-24 — ClosedLoopPanel: renders the safe-action catalog and previews the
// dry-run diff. Mocks ../api so no HTTP is made; the panel is preview-only
// (there is no Apply button — asserted below).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ClosedLoopPanel from "./ClosedLoopPanel";
import { orbitopsTheme } from "../theme";
import type { ActionCatalogItem, ActionDryRun } from "../types";

vi.mock("../api", () => ({
  getActionCatalog: vi.fn(),
  dryRunAction: vi.fn(),
}));

import { dryRunAction, getActionCatalog } from "../api";

const CATALOG: ActionCatalogItem[] = [
  {
    action_id: "scale_copilot_api_replicas",
    description: "Set spec.replicas of Deployment/copilot-api.",
    target_resource: "Deployment/copilot-api",
    inverse_action_id: "scale_copilot_api_replicas",
    params_spec: [{ name: "replicas", kind: "int", min: 1, max: 3, default: 2 }],
  },
  {
    action_id: "restart_emulator_pod",
    description: "Rolling-restart the emulator.",
    target_resource: "Deployment/ntn-metrics-emulator",
    inverse_action_id: null,
    params_spec: [],
  },
  {
    action_id: "set_payload_mode",
    description: "Set the emulator PAYLOAD_MODE env.",
    target_resource: "Deployment/ntn-metrics-emulator",
    inverse_action_id: "set_payload_mode",
    params_spec: [
      {
        name: "mode",
        kind: "enum",
        options: ["regenerative", "transparent"],
        default: "transparent",
      },
    ],
  },
];

function renderPanel() {
  return render(
    <ThemeProvider theme={orbitopsTheme}>
      <ClosedLoopPanel />
    </ThemeProvider>,
  );
}

describe("ClosedLoopPanel (VS-24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three safe actions from the catalog", async () => {
    vi.mocked(getActionCatalog).mockResolvedValue(CATALOG);
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("scale_copilot_api_replicas")).toBeInTheDocument(),
    );
    expect(screen.getByText("restart_emulator_pod")).toBeInTheDocument();
    expect(screen.getByText("set_payload_mode")).toBeInTheDocument();
  });

  it("is preview-only — no Apply button anywhere (apply deferred)", async () => {
    vi.mocked(getActionCatalog).mockResolvedValue(CATALOG);
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("scale_copilot_api_replicas")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();
  });

  it("clicking Preview calls dryRunAction with default params and shows the diff", async () => {
    vi.mocked(getActionCatalog).mockResolvedValue(CATALOG);
    const result: ActionDryRun = {
      action_id: "scale_copilot_api_replicas",
      params: { replicas: 2 },
      target_resource: "Deployment/copilot-api",
      patch: { spec: { replicas: 2 } },
      diff: "Deployment/copilot-api\n  spec.replicas: 2",
      inverse_action_id: "scale_copilot_api_replicas",
      dry_run: true,
      note: "dry-run only — no cluster mutation, no git commit, no apply.",
    };
    vi.mocked(dryRunAction).mockResolvedValue(result);

    const user = userEvent.setup();
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("scale_copilot_api_replicas")).toBeInTheDocument(),
    );

    // First Preview button is the scale action's.
    const buttons = screen.getAllByRole("button", { name: /preview change/i });
    await user.click(buttons[0]);

    expect(vi.mocked(dryRunAction)).toHaveBeenCalledWith(
      "scale_copilot_api_replicas",
      { replicas: 2 },
    );
    const diff = await screen.findByTestId(
      "dry-run-diff-scale_copilot_api_replicas",
    );
    expect(within(diff).getByText(/spec\.replicas: 2/)).toBeInTheDocument();
  });

  it("shows an error when the dry-run request fails", async () => {
    vi.mocked(getActionCatalog).mockResolvedValue(CATALOG);
    vi.mocked(dryRunAction).mockRejectedValue(new Error("boom"));

    const user = userEvent.setup();
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("scale_copilot_api_replicas")).toBeInTheDocument(),
    );
    await user.click(screen.getAllByRole("button", { name: /preview change/i })[0]);

    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });

  it("surfaces a load error when the catalog cannot be fetched", async () => {
    vi.mocked(getActionCatalog).mockRejectedValue(new Error("catalog down"));
    renderPanel();
    expect(await screen.findByText(/catalog down/)).toBeInTheDocument();
  });
});
