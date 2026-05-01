import {
  AppBar,
  Box,
  Chip,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import RouterRoundedIcon from "@mui/icons-material/RouterRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";

import { monoFamily } from "../theme";
import { env_ } from "../api";

interface TopBarProps {
  scenarioId: string;
  tickT: number;
  isLoading: boolean;
  onRefresh: () => void;
  drawerWidth: number;
}

export default function TopBar({
  scenarioId,
  tickT,
  isLoading,
  onRefresh,
  drawerWidth,
}: TopBarProps) {
  return (
    <AppBar
      position="fixed"
      sx={{
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 56, px: 2.5, gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <RouterRoundedIcon sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            OrbitOps Copilot
          </Typography>
          <Chip
            label="B5G / NTN"
            size="small"
            variant="outlined"
            sx={{
              ml: 1,
              color: "rgba(255,255,255,0.85)",
              borderColor: "rgba(255,255,255,0.4)",
            }}
          />
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 1,
              fontFamily: monoFamily,
              fontSize: "0.75rem",
            }}
          >
            <Box component="span" sx={{ opacity: 0.7 }}>
              scenario
            </Box>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {scenarioId}
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: 0.5,
              px: 1.25,
              py: 0.5,
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 1,
              fontFamily: monoFamily,
              fontSize: "0.75rem",
            }}
          >
            <Box component="span" sx={{ opacity: 0.7 }}>
              t =
            </Box>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {tickT}s
            </Box>
          </Box>

          <Tooltip title="Refresh metrics">
            <IconButton
              size="small"
              onClick={onRefresh}
              sx={{ color: "rgba(255,255,255,0.92)" }}
            >
              <RefreshRoundedIcon
                fontSize="small"
                sx={{
                  animation: isLoading ? "spin 1s linear infinite" : "none",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
            </IconButton>
          </Tooltip>

          <Tooltip title={`Prometheus → ${env_.PROMETHEUS_BASE}`}>
            <IconButton
              size="small"
              component="a"
              href={env_.PROMETHEUS_BASE}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "rgba(255,255,255,0.92)" }}
            >
              <LaunchRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
