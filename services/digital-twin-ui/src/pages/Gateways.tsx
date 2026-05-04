import { Box, Grid2 as Grid, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import MetricNumber from "../components/MetricNumber";
import { monoFamily } from "../theme";
import type { MetricsSnapshot } from "../types";

interface GatewaysProps {
  data: MetricsSnapshot | null;
}

export default function Gateways({ data }: GatewaysProps) {
  const { t } = useTranslation();
  const gws = data?.gateways ?? [];
  return (
    <Box>
      <SectionHeader
        category={t("nav.workloads")}
        title={t("nav.gateways")}
        subtitle={t("gateways.subtitle")}
      />

      {gws.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center", color: "text.secondary" }}>
          {t("gateways.empty")}
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {gws.map((g) => (
            <Grid key={g.gateway_id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: monoFamily, fontWeight: 600 }}>
                    {g.gateway_id}
                  </Typography>
                  <StatusChip
                    status={g.available ? "ok" : "crit"}
                    label={g.available ? t("gateways.statusAvailable") : t("gateways.statusDown")}
                  />
                </Stack>
                <Stack direction="row" spacing={4}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {t("gateways.fieldAvailable")}
                    </Typography>
                    <Typography variant="h6" sx={{ fontFamily: monoFamily }}>
                      {g.available ? "1" : "0"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {t("gateways.fieldLoad")}
                    </Typography>
                    <MetricNumber value={g.load == null ? null : g.load * 100} precision={1} unit="%" />
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
