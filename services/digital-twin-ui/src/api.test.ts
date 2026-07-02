import { afterEach, describe, expect, test, vi } from "vitest";
import { computeBeams, parsePromText } from "./api";

// Mock the token store so askCopilot's bearer/401 wiring can be driven
// deterministically. parsePromText/computeBeams don't touch auth, so this
// mock is inert for the rest of the file.
vi.mock("./lib/auth", () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

describe("parsePromText", () => {
  test("parses a single sample with labels", () => {
    const text = `# HELP orbitops_beam_snr_db SNR in dB
# TYPE orbitops_beam_snr_db gauge
orbitops_beam_snr_db{beam_id="beam-1"} 6.5
`;
    const out = parsePromText(text);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      name: "orbitops_beam_snr_db",
      labels: { beam_id: "beam-1" },
      value: 6.5,
    });
  });

  test("parses multi-label samples and skips comments", () => {
    const text = `
# HELP orbitops_beam_snr_db SNR
orbitops_beam_snr_db{beam_id="beam-1",zone="apac"} 12.5
orbitops_beam_snr_db{beam_id="beam-2"} 11.0
# TYPE foo gauge
some_other_metric 3.14
`;
    const out = parsePromText(text);
    expect(out).toHaveLength(3);
    expect(out[0].labels).toEqual({ beam_id: "beam-1", zone: "apac" });
    expect(out[1].value).toBe(11.0);
    expect(out[2]).toEqual({ name: "some_other_metric", labels: {}, value: 3.14 });
  });

  test("returns empty for empty input", () => {
    expect(parsePromText("")).toEqual([]);
  });

  test("ignores malformed lines", () => {
    const text = `not a metric line
orbitops_beam_snr_db{beam_id="beam-1"} 6.5
random garbage
`;
    expect(parsePromText(text)).toHaveLength(1);
  });

  test("handles negative + scientific values", () => {
    const text = `orbitops_doppler_residual_hz{beam_id="b"} -1.2e3
orbitops_packet_loss_ratio{beam_id="b"} 0.001
`;
    const out = parsePromText(text);
    expect(out[0].value).toBe(-1200);
    expect(out[1].value).toBe(0.001);
  });
});

describe("computeBeams — H.1.1 elevation_deg switch case (PR #45 bot #45-5)", () => {
  // Pins the api.ts switch arm that maps orbitops_beam_elevation_deg →
  // BeamView.elevation_deg. Without this test, a typo in the metric name
  // (or a future refactor that drops the case) would silently produce
  // NaN at runtime; Beams.test.tsx feeds elevation_deg directly so it
  // wouldn't catch the parsing-side regression.
  test("orbitops_beam_elevation_deg sample populates BeamView.elevation_deg", () => {
    const beams = computeBeams([
      { name: "orbitops_beam_snr_db", labels: { beam_id: "beam-1" }, value: 6.5 },
      { name: "orbitops_beam_elevation_deg", labels: { beam_id: "beam-1" }, value: 55 },
    ]);
    expect(beams).toHaveLength(1);
    expect(beams[0].elevation_deg).toBe(55);
  });

  test("missing elevation sample leaves elevation_deg as NaN", () => {
    const beams = computeBeams([
      { name: "orbitops_beam_snr_db", labels: { beam_id: "beam-2" }, value: 12.5 },
    ]);
    expect(beams).toHaveLength(1);
    expect(Number.isNaN(beams[0].elevation_deg)).toBe(true);
  });

  test("multiple beams each get their own elevation_deg", () => {
    const beams = computeBeams([
      { name: "orbitops_beam_elevation_deg", labels: { beam_id: "beam-1" }, value: 55 },
      { name: "orbitops_beam_elevation_deg", labels: { beam_id: "beam-2" }, value: 42 },
    ]);
    expect(beams).toHaveLength(2);
    const byId = Object.fromEntries(beams.map((b) => [b.beam_id, b.elevation_deg]));
    expect(byId).toEqual({ "beam-1": 55, "beam-2": 42 });
  });
});

// ─── VS-9b.1 — injectAnomaly contract ────────────────────────────────
// Wraps POST /anomaly/inject from PR #51. Required for the Anomalies-page
// "Inject anomaly" button (the demo UX that lets evaluators see the
// metric stream react to a fresh anomaly without editing scenario JSON).
import { injectAnomaly } from "./api";
import type { AnomalyType } from "./types";

describe("injectAnomaly", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("posts to /anomaly/inject with the supplied body", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          type: "snr_drop",
          target: "beam-1",
          t_start: 0,
          t_end: 60,
          duration_seconds: 60,
          currently_active: ["snr_drop"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await injectAnomaly({
      type: "snr_drop" as AnomalyType,
      target: "beam-1",
      duration_seconds: 60,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/anomaly\/inject$/);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      type: "snr_drop",
      target: "beam-1",
      duration_seconds: 60,
    });
    expect(result.type).toBe("snr_drop");
    expect(result.currently_active).toContain("snr_drop");
  });

  test("propagates non-2xx as Error so the UI can render a banner", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "no scenario loaded" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    await expect(injectAnomaly({ type: "snr_drop" as AnomalyType })).rejects.toThrow(
      /409|no scenario/i,
    );
  });

  test("omits optional fields when not supplied", async () => {
    let captured: unknown = null;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      captured = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          type: "handover_failure",
          target: "beam-1",
          t_start: 0,
          t_end: 60,
          duration_seconds: 60,
          currently_active: ["handover_failure"],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await injectAnomaly({ type: "handover_failure" as AnomalyType });
    expect(captured).toEqual({ type: "handover_failure" });
  });
});

// ─── VS-9b.1 self-/review Check-4: network-hang timeout ───────────────
// If the emulator hangs (high latency / packet loss), injectAnomaly must
// reject on a bounded timeout rather than wedge the UI's pending state
// forever. Default 5s; overridable for tests via the options arg.

describe("injectAnomaly timeout", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects with timeout when fetch never resolves before timeoutMs", async () => {
    // Mock that respects the AbortSignal — never resolves on its own,
    // only rejects when the signal aborts.
    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as typeof fetch;

    const start = Date.now();
    await expect(
      injectAnomaly(
        { type: "snr_drop" as AnomalyType },
        { timeoutMs: 50 },
      ),
    ).rejects.toThrow(/timed out|timeout|abort/i);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(500);
  });
});

// ─── AC-S003-VS19.11/.12 — askCopilot auth wiring (REAL request path) ──
// These drive the actual code path the app uses (askCopilot's fetch), not
// an unused axios instance. They are the tests that would have caught the
// "JWT never sent" bug: they assert the bearer is attached from storage and
// that a 401 clears the token and redirects.
import { askCopilot } from "./api";
import * as auth from "./lib/auth";

describe("askCopilot auth wiring (AC-S003-VS19.11/.12)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  function okResponse() {
    return new Response(JSON.stringify({ status: "OK" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  test("AC-.11: attaches Authorization: Bearer when a token is stored", async () => {
    vi.mocked(auth.getToken).mockReturnValue("live-token");
    let captured: Record<string, string> = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      captured = init.headers as Record<string, string>;
      return okResponse();
    }) as typeof fetch;

    await askCopilot({ question: "status?" });
    expect(captured.Authorization).toBe("Bearer live-token");
  });

  test("AC-.11: omits Authorization when no token is stored", async () => {
    vi.mocked(auth.getToken).mockReturnValue(null);
    let captured: Record<string, string> = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      captured = init.headers as Record<string, string>;
      return okResponse();
    }) as typeof fetch;

    await askCopilot({ question: "status?" });
    expect(captured.Authorization).toBeUndefined();
  });

  test("AC-.12: on 401 clears the token and redirects to /login", async () => {
    vi.mocked(auth.getToken).mockReturnValue("stale-token");
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
      })) as typeof fetch;

    const orig = window.location;
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/", pathname: "/" },
      writable: true,
      configurable: true,
    });

    const res = await askCopilot({ question: "status?" });

    expect(vi.mocked(auth.clearToken)).toHaveBeenCalledOnce();
    expect(window.location.href).toBe("/login");
    expect(res.status).toBe("ERROR");
    expect(res.error).toBe("HTTP 401");

    Object.defineProperty(window, "location", {
      value: orig,
      writable: true,
      configurable: true,
    });
  });

  test("AC-.12: does NOT redirect-loop when the 401 arrives on /login", async () => {
    vi.mocked(auth.getToken).mockReturnValue("stale-token");
    globalThis.fetch = (async () =>
      new Response("{}", { status: 401 })) as typeof fetch;

    const orig = window.location;
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/login", pathname: "/login" },
      writable: true,
      configurable: true,
    });

    await askCopilot({ question: "status?" });

    // token still cleared, but href untouched (no bounce while already on /login)
    expect(vi.mocked(auth.clearToken)).toHaveBeenCalledOnce();
    expect(window.location.href).toBe("http://localhost/login");

    Object.defineProperty(window, "location", {
      value: orig,
      writable: true,
      configurable: true,
    });
  });
});
