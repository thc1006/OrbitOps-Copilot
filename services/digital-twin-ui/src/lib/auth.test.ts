// AC-S003-VS19.10/.11/.12 — UI auth token helpers (RED phase)
// These tests will fail until src/lib/auth.ts is created.
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Deliberately importing from the not-yet-existing module.
// TypeScript will error during `tsc --noEmit`; vitest run will error
// at import time — both are the expected RED state.
import { clearToken, getToken, setToken } from "./auth";

const TOKEN_KEY = "orbitops_token";

describe("auth token helpers (AC-S003-VS19.10)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("getToken returns null when nothing is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken stores the token under orbitops_token key", () => {
    setToken("my-test-token");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("my-test-token");
  });

  it("getToken retrieves the stored token", () => {
    localStorage.setItem(TOKEN_KEY, "retrieved-token");
    expect(getToken()).toBe("retrieved-token");
  });

  it("clearToken removes the token from localStorage", () => {
    localStorage.setItem(TOKEN_KEY, "to-be-cleared");
    clearToken();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
