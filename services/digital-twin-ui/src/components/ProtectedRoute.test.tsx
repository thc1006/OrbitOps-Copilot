// AC-S003-VS19.10 — ProtectedRoute guards the app: an unauthenticated visitor
// is redirected to /login; an authenticated one sees the protected content.
// App.test.tsx always seeds a token in beforeEach, so this is the only test
// that exercises the redirect (no-token) branch.
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>secret-dashboard</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute (AC-S003-VS19.10)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects to /login when no token is present", () => {
    renderAt("/");
    expect(screen.getByText("login-page")).toBeInTheDocument();
    expect(screen.queryByText("secret-dashboard")).not.toBeInTheDocument();
  });

  it("renders children when a token is present", () => {
    localStorage.setItem("orbitops_token", "some-token");
    renderAt("/");
    expect(screen.getByText("secret-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("login-page")).not.toBeInTheDocument();
  });
});
