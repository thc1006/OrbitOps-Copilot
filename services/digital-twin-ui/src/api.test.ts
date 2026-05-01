import { describe, expect, test } from "vitest";
import { parsePromText } from "./api";

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
