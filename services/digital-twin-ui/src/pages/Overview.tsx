import {
  Alert,
  Box,
  Grid2 as Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SatelliteAltRoundedIcon from "@mui/icons-material/SatelliteAltRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import { Trans, useTranslation } from "react-i18next";

import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import MetricNumber from "../components/MetricNumber";
import { monoFamily } from "../theme";
import type { MetricsSnapshot } from "../types";

interface OverviewProps {
  poll: {
    data: MetricsSnapshot | null;
    error: Error | null;
    isLoading: boolean;
    lastFetched: number | null;
  };
}

interface StatCardProps {
  Icon: typeof SatelliteAltRoundedIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "ok" | "warn" | "crit";
}

function StatCard({ Icon, label, value, hint, tone = "ok" }: StatCardProps) {
  const toneColor =
    tone === "crit" ? "error.main" : tone === "warn" ? "warning.main" : "primary.main";
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: toneColor,
            flexShrink: 0,
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ display: "block", color: "text.secondary", lineHeight: 1.2 }}
          >
            {label}
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontFamily: monoFamily,
              fontVariantNumeric: "tabular-nums",
              fontSize: "1.75rem",
              fontWeight: 500,
              lineHeight: 1.1,
              mt: 0.5,
              color: toneColor,
            }}
          >
            {value}
          </Typography>
          {hint && (
            <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
              {hint}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function Overview({ poll }: OverviewProps) {
  const { t } = useTranslation();
  const data = poll.data;
  const beams = data?.beams ?? [];
  const gws = data?.gateways ?? [];
  const critBeams = beams.filter((b) => b.health === "crit").length;
  const warnBeams = beams.filter((b) => b.health === "warn").length;
  const beamsTone = critBeams > 0 ? "crit" : warnBeams > 0 ? "warn" : "ok";
  const gwsDown = gws.filter((g) => !g.available).length;

  const lastFetched =
    poll.lastFetched != null
      ? new Date(poll.lastFetched).toLocaleTimeString()
      : "—";

  return (
    <Box>
      <SectionHeader
        category={t("nav.cluster")}
        title={t("nav.overview")}
        subtitle={t("overview.subtitle")}
      />

      {poll.isLoading && !data && <LinearProgress sx={{ mb: 3 }} />}
      {poll.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Cannot reach emulator: {poll.error.message}. Check VITE_EMULATOR_BASE_URL.
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            Icon={SatelliteAltRoundedIcon}
            label={t("overview.metric.beams")}
            value={beams.length}
            tone={beamsTone}
            hint={
              critBeams || warnBeams
                ? `${critBeams} crit · ${warnBeams} warn`
                : "all healthy"
            }
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            Icon={HubRoundedIcon}
            label={t("overview.metric.gateways")}
            value={gws.length}
            tone={gwsDown > 0 ? "crit" : "ok"}
            hint={gwsDown > 0 ? `${gwsDown} unavailable` : "all available"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            Icon={ReportProblemRoundedIcon}
            label={t("overview.metric.activeAnomalies")}
            value={data?.active_anomalies?.length ?? 0}
            tone={(data?.active_anomalies?.length ?? 0) > 0 ? "warn" : "ok"}
            hint={data?.active_anomalies?.join(", ") || "none"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            Icon={AccessTimeRoundedIcon}
            label={t("overview.metric.tick")}
            value={`${data?.t_seconds ?? 0}s`}
            hint={`refreshed ${lastFetched}`}
          />
        </Grid>
      </Grid>

      <Paper sx={{ p: 0 }}>
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="subtitle1">{t("overview.beamSummary")}</Typography>
          <Typography variant="caption">
            {beams.length} item(s) · live from /metrics
          </Typography>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Box
            component="table"
            sx={{
              width: "100%",
              borderCollapse: "collapse",
              "& th, & td": { px: 3, py: 1.25, textAlign: "left" },
              "& th": {
                bgcolor: "background.default",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "text.secondary",
                fontWeight: 600,
              },
              "& tbody tr:hover": { bgcolor: "action.hover" },
              "& td": { borderTop: "1px solid", borderColor: "divider" },
            }}
          >
            <thead>
              <tr>
                <th>{t("overview.table.beamId")}</th>
                <th>{t("overview.table.snr")}</th>
                <th>{t("overview.table.latency")}</th>
                <th>{t("overview.table.loss")}</th>
                <th>{t("overview.table.doppler")}</th>
                <th>{t("overview.table.handover")}</th>
                <th>{t("overview.table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {beams.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: "#64748B" }}>
                    <Trans
                      i18nKey="overview.empty"
                      components={{ 1: <strong /> }}
                    />
                  </td>
                </tr>
              )}
              {beams.map((b) => (
                <tr key={b.beam_id}>
                  <td style={{ fontFamily: monoFamily, fontWeight: 600 }}>{b.beam_id}</td>
                  <td><MetricNumber value={b.snr_db} bold={b.health === "crit"} /></td>
                  <td><MetricNumber value={b.latency_ms} precision={1} /></td>
                  <td><MetricNumber value={b.packet_loss_ratio * 100} precision={2} unit="%" /></td>
                  <td><MetricNumber value={b.doppler_residual_hz} precision={0} /></td>
                  <td>
                    <Box component="span" sx={{ fontFamily: monoFamily }}>
                      {/* Per docs/contracts/metrics.md §3:
                          0=stable, 1=preparing, 2=failure. */}
                      {["stable", "preparing", "failure"][b.handover_state] ?? `state=${b.handover_state}`}
                    </Box>
                  </td>
                  <td><StatusChip status={b.health} /></td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
