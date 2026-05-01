import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";

import StatusChip from "./StatusChip";
import { orbitopsTheme } from "../theme";

const wrap = (node: React.ReactNode) => (
  <ThemeProvider theme={orbitopsTheme}>{node}</ThemeProvider>
);

describe("StatusChip", () => {
  test.each([
    ["ok", "Healthy"],
    ["warn", "Degraded"],
    ["crit", "Critical"],
    ["unknown", "Unknown"],
  ] as const)("renders default label for %s", (status, label) => {
    render(wrap(<StatusChip status={status} />));
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test("respects label override", () => {
    render(wrap(<StatusChip status="warn" label="Active" />));
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Degraded")).not.toBeInTheDocument();
  });
});
