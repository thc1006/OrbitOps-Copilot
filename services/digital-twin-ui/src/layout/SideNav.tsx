import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { NavLink, useLocation } from "react-router-dom";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import SatelliteAltRoundedIcon from "@mui/icons-material/SatelliteAltRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import AssistantRoundedIcon from "@mui/icons-material/AssistantRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import { env_ } from "../api";

interface SideNavProps {
  drawerWidth: number;
}

interface NavGroup {
  label: string;
  items: {
    to: string;
    label: string;
    Icon: typeof DashboardRoundedIcon;
  }[];
}

const groups: NavGroup[] = [
  {
    label: "Cluster",
    items: [
      { to: "/",          label: "Overview",  Icon: DashboardRoundedIcon },
      { to: "/scenarios", label: "Scenarios", Icon: PlayCircleOutlineRoundedIcon },
    ],
  },
  {
    label: "Workloads",
    items: [
      { to: "/beams",    label: "Beams",    Icon: SatelliteAltRoundedIcon },
      { to: "/gateways", label: "Gateways", Icon: HubRoundedIcon },
    ],
  },
  {
    label: "Events",
    items: [
      { to: "/anomalies", label: "Anomalies", Icon: ReportProblemRoundedIcon },
    ],
  },
  {
    label: "AI Ops",
    items: [
      { to: "/copilot", label: "Copilot", Icon: AssistantRoundedIcon },
    ],
  },
];

const externals: { href: string; label: string }[] = [
  { href: env_.PROMETHEUS_BASE, label: "Prometheus" },
  { href: env_.GRAFANA_BASE, label: "Grafana" },
];

export default function SideNav({ drawerWidth }: SideNavProps) {
  const loc = useLocation();
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
        },
      }}
    >
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          pl: 2.5,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 0.5,
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            color: "white",
          }}
        >
          OC
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ color: "white", lineHeight: 1.2 }}>
            OrbitOps
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.55)", display: "block", lineHeight: 1.1 }}
          >
            Sprint 1 · Local
          </Typography>
        </Box>
      </Box>

      {groups.map((g) => (
        <Box key={g.label} sx={{ mt: 2 }}>
          <Typography
            variant="overline"
            sx={{
              px: 2.5,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.12em",
            }}
          >
            {g.label}
          </Typography>
          <List dense disablePadding>
            {g.items.map((it) => {
              const Icon = it.Icon;
              const active =
                it.to === "/"
                  ? loc.pathname === "/"
                  : loc.pathname.startsWith(it.to);
              return (
                <ListItemButton
                  key={it.to}
                  component={NavLink}
                  to={it.to}
                  selected={active}
                  sx={{
                    mx: 1,
                    borderRadius: 1,
                    color: "rgba(255,255,255,0.78)",
                    "&.Mui-selected": {
                      bgcolor: "rgba(50,108,229,0.18)",
                      color: "white",
                      "& .MuiListItemIcon-root": { color: "primary.light" },
                    },
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.06)",
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: "rgba(255,255,255,0.65)" }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={it.label}
                    primaryTypographyProps={{ fontSize: "0.8125rem" }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      ))}

      <Box sx={{ flexGrow: 1 }} />

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 1, mt: 2 }} />
      <Box sx={{ px: 2.5, pb: 2 }}>
        <Typography
          variant="overline"
          sx={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}
        >
          External
        </Typography>
        {externals.map((e) => (
          <Box
            key={e.href}
            component="a"
            href={e.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.5,
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.8125rem",
              textDecoration: "none",
              "&:hover": { color: "white" },
            }}
          >
            {e.label}
            <OpenInNewRoundedIcon sx={{ fontSize: 14, opacity: 0.7 }} />
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}
