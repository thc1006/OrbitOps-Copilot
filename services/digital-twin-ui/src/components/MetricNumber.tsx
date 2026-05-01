import { Box } from "@mui/material";
import { monoFamily } from "../theme";

interface MetricNumberProps {
  value: number | null | undefined;
  unit?: string;
  /** Decimals when finite. Default = 2. */
  precision?: number;
  /** Override colour (e.g. red on critical). */
  color?: string;
  bold?: boolean;
}

/**
 * Numeric value rendered in monospace so columns align. Shows "—" for
 * NaN / null so empty cells don't visually shift the column width.
 */
export default function MetricNumber({
  value,
  unit,
  precision = 2,
  color,
  bold,
}: MetricNumberProps) {
  const isFinite =
    typeof value === "number" && Number.isFinite(value);
  const display = isFinite ? (value as number).toFixed(precision) : "—";
  return (
    <Box
      component="span"
      sx={{
        fontFamily: monoFamily,
        fontVariantNumeric: "tabular-nums",
        fontWeight: bold ? 600 : 400,
        color: color ?? "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {display}
      {unit && isFinite ? (
        <Box
          component="span"
          sx={{ ml: 0.5, color: "text.secondary", fontSize: "0.75em" }}
        >
          {unit}
        </Box>
      ) : null}
    </Box>
  );
}
