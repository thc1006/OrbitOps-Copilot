// AC-S003-VS19.11/.12 — copilotAxios interceptors (RED phase)
// These tests will fail until:
//   1. axios is installed (npm install axios)
//   2. src/lib/axiosInstance.ts is created
//   3. src/lib/auth.ts is created
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth so tests control what getToken() returns
vi.mock("./auth", () => ({
  getToken: vi.fn(),
  clearToken: vi.fn(),
  setToken: vi.fn(),
}));

describe("copilotAxios interceptors", () => {
  // Reset modules before each test so we get a fresh interceptor list
  // (interceptors are registered on module import; vi.resetModules() gives
  // a clean slate that mirrors real browser behaviour at cold-start).
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Provide a writable window.location.href so the redirect test can assert
    Object.defineProperty(window, "location", {
      value: { href: "/" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── AC-S003-VS19.11 ──────────────────────────────────────────────────
  it(
    "AC-S003-VS19.11: request interceptor adds Authorization header when token exists",
    async () => {
      // Set up getToken mock BEFORE importing axiosInstance so the module
      // picks up our mock on its first call inside the interceptor.
      const authMod = await import("./auth");
      vi.mocked(authMod.getToken).mockReturnValue("test-bearer-token");

      const { copilotAxios } = await import("./axiosInstance");

      // Reach into the interceptor handlers list and call fulfilled() directly.
      // This is the most reliable cross-version technique for axios interceptors:
      // no network call needed, tests pure request transformation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (copilotAxios.interceptors.request as any).handlers as Array<{
        fulfilled: (cfg: { headers: Record<string, string> }) => { headers: Record<string, string> };
      }>;

      expect(handlers.length).toBeGreaterThan(0);

      const config = { headers: {} as Record<string, string> };
      const result = handlers[0].fulfilled(config);
      expect(result.headers["Authorization"]).toBe("Bearer test-bearer-token");
    },
  );

  it(
    "AC-S003-VS19.11: request interceptor skips Authorization when no token",
    async () => {
      const authMod = await import("./auth");
      vi.mocked(authMod.getToken).mockReturnValue(null);

      const { copilotAxios } = await import("./axiosInstance");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (copilotAxios.interceptors.request as any).handlers as Array<{
        fulfilled: (cfg: { headers: Record<string, string> }) => { headers: Record<string, string> };
      }>;

      const config = { headers: {} as Record<string, string> };
      const result = handlers[0].fulfilled(config);
      expect(result.headers["Authorization"]).toBeUndefined();
    },
  );

  // ── AC-S003-VS19.12 ──────────────────────────────────────────────────
  it(
    "AC-S003-VS19.12: response interceptor clears token and redirects on 401",
    async () => {
      const authMod = await import("./auth");
      const { copilotAxios } = await import("./axiosInstance");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (copilotAxios.interceptors.response as any).handlers as Array<{
        rejected: (err: unknown) => Promise<never>;
      }>;

      expect(handlers.length).toBeGreaterThan(0);

      // Call the error handler with a 401-shaped axios error
      const error401 = { response: { status: 401 } };
      await expect(handlers[0].rejected(error401)).rejects.toBeDefined();

      expect(vi.mocked(authMod.clearToken)).toHaveBeenCalledOnce();
      expect(window.location.href).toBe("/login");
    },
  );

  it(
    "AC-S003-VS19.12: response interceptor does NOT redirect for non-401 errors",
    async () => {
      const authMod = await import("./auth");
      const { copilotAxios } = await import("./axiosInstance");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (copilotAxios.interceptors.response as any).handlers as Array<{
        rejected: (err: unknown) => Promise<never>;
      }>;

      const error500 = { response: { status: 500 } };
      await expect(handlers[0].rejected(error500)).rejects.toBeDefined();

      // clearToken and redirect must NOT have been called for a 500
      expect(vi.mocked(authMod.clearToken)).not.toHaveBeenCalled();
      expect(window.location.href).toBe("/");
    },
  );
});
