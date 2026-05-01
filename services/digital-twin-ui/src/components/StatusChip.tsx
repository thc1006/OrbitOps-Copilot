import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";

import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

export type ChipStatus = "ok" | "warn" | "crit" | "unknown";

const palette: Record<ChipStatus, { color: ChipProps["color"]; label: string; Icon: typeof CheckCircleOutlineRoundedIcon }> = {
  ok:      { color: "success", label: "Healthy",   Icon: CheckCircleOutlineRoundedIcon },
  warn:    { color: "warning", label: "Degraded",  Icon: WarningAmberRoundedIcon },
  crit:    { color: "error",   label: "Critical",  Icon: ErrorOutlineRoundedIcon },
  unknown: { color: "default", label: "Unknown",   Icon: HelpOutlineRoundedIcon },
};

interface StatusChipProps {
  status: ChipStatus;
  /** Override the default label (e.g. "Active" for an anomaly chip). */
  label?: string;
  variant?: ChipProps["variant"];
}

export default function StatusChip({ status, label, variant = "filled" }: StatusChipProps) {
  const cfg = palette[status];
  const Icon = cfg.Icon;
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 14 }} />}
      label={label ?? cfg.label}
      color={cfg.color}
      variant={variant}
      sx={{ "& .MuiChip-icon": { ml: 0.5, mr: -0.25 } }}
    />
  );
}
