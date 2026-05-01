import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  /** "Workloads" / "Discovery" — k8s-Dashboard-style overline. */
  category: string;
  /** Page title. */
  title: string;
  /** Subtitle / context line under the title. */
  subtitle?: string;
  /** Right-aligned action area (refresh, filters, primary buttons). */
  actions?: ReactNode;
}

export default function SectionHeader({
  category,
  title,
  subtitle,
  actions,
}: SectionHeaderProps) {
  return (
    <Box
      sx={{
        pb: 2.5,
        mb: 3,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "flex-end" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography
            variant="overline"
            color="primary"
            sx={{ display: "block", letterSpacing: "0.12em" }}
          >
            {category}
          </Typography>
          <Typography variant="h4" sx={{ fontSize: "1.5rem", lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 720 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box>{actions}</Box>}
      </Stack>
    </Box>
  );
}
