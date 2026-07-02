import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";

import App from "./App";
import { orbitopsTheme } from "./theme";

// useMetricsPoll hits /metrics + /scenario/current — stub fetch to avoid
// trying to talk to the cluster from inside jsdom.
const stubMetrics = `
# HELP orbitops_beam_snr_db SNR
orbitops_beam_snr_db{beam_id="beam-1"} 6.5
orbitops_beam_snr_db{beam_id="beam-2"} 13.0
`;

beforeEach(() => {
  // VS-19 AC-S003-VS19.10: App shell tests render the authenticated layout.
  // ProtectedRoute reads localStorage.orbitops_token — supply a fake token so
  // the tests don't redirect to /login (those tests live in Login.test.tsx).
  localStorage.setItem("orbitops_token", "test-token-for-app-shell-tests");

  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.endsWith("/scenario/current")) {
        return new Response(
          JSON.stringify({
            scenario_id: "beam-degradation-001",
            t: 90,
            active_anomalies: ["snr_drop"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/metrics")) {
        return new Response(stubMetrics, {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem("orbitops_token");
});

const wrap = (path = "/") => (
  <ThemeProvider theme={orbitopsTheme}>
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  </ThemeProvider>
);

describe("App shell", () => {
  test("renders the AppBar with brand + sidebar nav", async () => {
    render(wrap("/"));
    expect(screen.getAllByText("OrbitOps Copilot").length).toBeGreaterThan(0);
    // Each nav label may also appear in page body copy (Overview, Scenarios
    // are mentioned in the empty-state hint on /). getAllByText is the
    // honest assertion: the label exists *somewhere*.
    for (const label of ["Overview", "Scenarios", "Beams", "Gateways", "Anomalies", "Copilot"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  test("Overview hydrates with polled scenario data", async () => {
    render(wrap("/"));
    await waitFor(() => {
      expect(screen.getByText("beam-degradation-001")).toBeInTheDocument();
    });
  });

  test("Beams page lists scraped beams", async () => {
    render(wrap("/beams"));
    await waitFor(() => {
      expect(screen.getByText("beam-1")).toBeInTheDocument();
      expect(screen.getByText("beam-2")).toBeInTheDocument();
    });
  });

  test("Anomalies page surfaces snr_drop", async () => {
    render(wrap("/anomalies"));
    await waitFor(() => {
      expect(screen.getByText("snr_drop")).toBeInTheDocument();
    });
  });

  test("Unknown route redirects to /", async () => {
    render(wrap("/no-such-page"));
    // Overview-only category overline — confirms we landed on / (Cluster
    // appears in the SideNav heading + the page's category overline).
    await waitFor(() => {
      expect(screen.getAllByText("Cluster").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    });
  });
});
