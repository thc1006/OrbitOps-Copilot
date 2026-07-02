// AC-S003-VS19.11/.12 — copilotAxios interceptors
// Strategy: import copilotAxios once at module level (no vi.resetModules),
// then call the interceptor handler functions directly so no real HTTP
// request is ever made. This is the correct approach for testing
// axios interceptors in vitest/jsdom without triggering the axios
// isURLSameOrigin IIFE issue (it reads window.location.href at module
// load time; if window.location was reassigned to { href: "/" } before
// that load, new URL("/") throws ERR_INVALID_URL).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth BEFORE importing axiosInstance so the interceptors use the mock.
vi.mock("./auth", () => ({
  getToken: vi.fn(),
  clearToken: vi.fn(),
  setToken: vi.fn(),
}));

// Import auth mock reference for use in tests
import * as auth from "./auth";
// Import copilotAxios once — interceptors are registered at this point
import { copilotAxios } from "./axiosInstance";

// ── Type alias for the handler shape that vitest exposes ──────────────
type ReqHandler = {
  fulfilled: (cfg: { headers: Record<string, string> }) => { headers: Record<string, string> };
  rejected?: (err: unknown) => Promise<never>;
  synchronous?: boolean;
  runWhen?: null | ((config: unknown) => boolean);
};
type ResHandler = {
  fulfilled?: (r: unknown) => unknown;
  rejected?: (err: unknown) => Promise<never>;
  synchronous?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reqHandlers = (): ReqHandler[] => (copilotAxios.interceptors.request as any).handlers as ReqHandler[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resHandlers = (): ResHandler[] => (copilotAxios.interceptors.response as any).handlers as ResHandler[];

describe("copilotAxios interceptors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a writable window.location.href so the redirect test can assert.
    // We set a valid absolute URL so it doesn't break any axios URL parsing
    // if the module is somehow re-entered after this assignment.
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/" },
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
    () => {
      vi.mocked(auth.getToken).mockReturnValue("test-bearer-token");

      const handlers = reqHandlers();
      expect(handlers.length).toBeGreaterThan(0);

      const config = { headers: {} as Record<string, string> };
      const result = handlers[0].fulfilled(config);
      expect(result.headers["Authorization"]).toBe("Bearer test-bearer-token");
    },
  );

  it(
    "AC-S003-VS19.11: request interceptor skips Authorization when no token",
    () => {
      vi.mocked(auth.getToken).mockReturnValue(null);

      const handlers = reqHandlers();
      const config = { headers: {} as Record<string, string> };
      const result = handlers[0].fulfilled(config);
      expect(result.headers["Authorization"]).toBeUndefined();
    },
  );

  // ── AC-S003-VS19.12 ──────────────────────────────────────────────────
  it(
    "AC-S003-VS19.12: response interceptor clears token and redirects on 401",
    async () => {
      const handlers = resHandlers();
      expect(handlers.length).toBeGreaterThan(0);

      const errorHandler = handlers[0].rejected;
      expect(errorHandler).toBeDefined();

      const error401 = { response: { status: 401 } };
      await expect(errorHandler!(error401)).rejects.toBeDefined();

      expect(vi.mocked(auth.clearToken)).toHaveBeenCalledOnce();
      expect(window.location.href).toBe("/login");
    },
  );

  it(
    "AC-S003-VS19.12: response interceptor does NOT redirect for non-401 errors",
    async () => {
      const handlers = resHandlers();
      const errorHandler = handlers[0].rejected;
      expect(errorHandler).toBeDefined();

      const error500 = { response: { status: 500 } };
      await expect(errorHandler!(error500)).rejects.toBeDefined();

      // clearToken and redirect must NOT have been called for a 500
      expect(vi.mocked(auth.clearToken)).not.toHaveBeenCalled();
      expect(window.location.href).toBe("http://localhost/");
    },
  );
});
