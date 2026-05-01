import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";

import MetricNumber from "./MetricNumber";
import { orbitopsTheme } from "../theme";

const wrap = (node: React.ReactNode) => (
  <ThemeProvider theme={orbitopsTheme}>{node}</ThemeProvider>
);

describe("MetricNumber", () => {
  test("renders finite value with default precision", () => {
    render(wrap(<MetricNumber value={6.5} />));
    expect(screen.getByText("6.50")).toBeInTheDocument();
  });

  test("renders unit alongside value", () => {
    render(wrap(<MetricNumber value={6.5} unit="dB" />));
    expect(screen.getByText("6.50")).toBeInTheDocument();
    expect(screen.getByText("dB")).toBeInTheDocument();
  });

  test("respects custom precision", () => {
    render(wrap(<MetricNumber value={32.123} precision={1} />));
    expect(screen.getByText("32.1")).toBeInTheDocument();
  });

  test("renders em-dash for NaN", () => {
    render(wrap(<MetricNumber value={NaN} />));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  test("renders em-dash for null", () => {
    render(wrap(<MetricNumber value={null} />));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  test("does NOT render unit when value is non-finite", () => {
    render(wrap(<MetricNumber value={null} unit="dB" />));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("dB")).not.toBeInTheDocument();
  });
});
