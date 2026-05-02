import { describe, expect, test } from "vitest";
import { computeBeams, parsePromText } from "./api";

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
