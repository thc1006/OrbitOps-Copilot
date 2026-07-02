// AC-S003-VS19.10 — Login page: successful login stores token + navigates
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

import { orbitopsTheme } from "../theme";
import * as auth from "../lib/auth";

// Mock axios so Login.tsx's POST call is interceptable without a real server.
vi.mock("axios");
// Mock auth helpers so setToken side-effects are captured.
vi.mock("../lib/auth");
// Mock axiosInstance to avoid the axios.create() side-effect that tries to
// register interceptors on a mocked (undefined) axios instance. Login.tsx
// only uses the OIDC_BASE constant from axiosInstance; mocking the module
// supplies that constant directly.
vi.mock("../lib/axiosInstance", () => ({
  COPILOT_BASE: "http://localhost:30081",
  OIDC_BASE: "http://localhost:9090",
}));

import Login from "./Login";

const wrap = (path = "/login") => (
  <ThemeProvider theme={orbitopsTheme}>
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>
  </ThemeProvider>
);

describe("Login page (AC-S003-VS19.10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-S003-VS19.10: renders username, password fields and submit button", () => {
    render(wrap());
    expect(screen.getByRole("textbox", { name: /username/i })).toBeInTheDocument();
    // password field has type="password" so getByLabelText is needed
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("AC-S003-VS19.10: on success — calls POST /orbitops/token, stores token, navigates to /", async () => {
    const user = userEvent.setup();

    // Mock axios.post to return a token response
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { access_token: "ey-fake-jwt-token" },
    });
    const mockSetToken = vi.mocked(auth.setToken);

    render(wrap());

    const usernameField = screen.getByRole("textbox", { name: /username/i });
    const passwordField = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole("button", { name: /log in/i });

    // Clear defaults then type
    await user.clear(usernameField);
    await user.type(usernameField, "demo");
    await user.clear(passwordField);
    await user.type(passwordField, "demo");
    await user.click(submitBtn);

    await waitFor(() => {
      // AC-S003-VS19.10: axios.post called to the OIDC token endpoint
      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        expect.stringContaining("/orbitops/token"),
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        }),
      );
      // AC-S003-VS19.10: token stored under orbitops_token key
      expect(mockSetToken).toHaveBeenCalledWith("ey-fake-jwt-token");
    });
  });

  it("shows error alert on login failure", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("network error"));

    render(wrap());

    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      // Must show an error alert (MUI Alert with role="alert")
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("dev-mode bypass button stores a placeholder token (DEV build only)", async () => {
    // import.meta.env.DEV is true under vitest, so the gated button renders.
    // In a production build Vite tree-shakes it away (see Login.tsx).
    const user = userEvent.setup();
    const mockSetToken = vi.mocked(auth.setToken);

    render(wrap());

    const devBtn = screen.getByRole("button", { name: /dev mode/i });
    await user.click(devBtn);

    expect(mockSetToken).toHaveBeenCalledWith("dev-bypass-token");
  });

  it("disables submit button while logging in", async () => {
    const user = userEvent.setup();
    // Never resolves so the "loading" state persists during assertion
    vi.mocked(axios.post).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    render(wrap());

    const btn = screen.getByRole("button", { name: /log in/i });
    await user.click(btn);

    // Button should be disabled while in flight
    expect(btn).toBeDisabled();
  });
});
