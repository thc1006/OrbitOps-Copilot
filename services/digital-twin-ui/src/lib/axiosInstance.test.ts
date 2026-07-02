// axiosInstance now exports only resolved base URLs. The copilot request
// transport (bearer + 401 handling) moved into api.ts::askCopilot and is
// covered by real request-path tests in src/api.test.ts. These tests pin the
// default-resolution logic so a regression in the origin-based fallback is
// caught. (The previous suite here poked axios interceptor handlers directly
// on an instance the app never used — a false-green that hid the fact the JWT
// was never sent; see api.test.ts "askCopilot auth wiring".)
import { describe, expect, it } from "vitest";
import { COPILOT_BASE, OIDC_BASE } from "./axiosInstance";

describe("axiosInstance base URLs", () => {
  it("COPILOT_BASE resolves against the page origin on port 30081 by default", () => {
    // vite.config sets the jsdom URL to http://localhost/, so hostname=localhost
    // and no VITE_COPILOT_BASE_URL override is set in the test env.
    expect(COPILOT_BASE).toMatch(/^https?:\/\/localhost:30081$/);
  });

  it("OIDC_BASE falls back to the local mock-oidc default (compose host port)", () => {
    // 19090 = docker-compose host mapping; 9090 would collide with Prometheus.
    expect(OIDC_BASE).toBe("http://localhost:19090");
  });
});
