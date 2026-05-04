import { lazy, Suspense } from "react";
import { Box, CircularProgress, Toolbar } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

import TopBar from "./layout/TopBar";
import SideNav from "./layout/SideNav";
import { useMetricsPoll } from "./hooks/useMetricsPoll";

import Overview from "./pages/Overview";
import Scenarios from "./pages/Scenarios";
import Beams from "./pages/Beams";
import Gateways from "./pages/Gateways";
import Anomalies from "./pages/Anomalies";
import Copilot from "./pages/Copilot";

// VS-13 S3 (2026-05-04, addresses PR #77 review #1): SatelliteView is
// lazy-loaded so cesium (~5 MB) only ships when the user navigates to
// /satellite-view. Eager import would push the initial chunk to 5.4 MB
// for every page (Overview / Beams / Copilot — none of which need it).
// The Suspense fallback covers the network round-trip for the cesium
// chunk + the brief mount delay before the WebGL viewer initializes.
const SatelliteView = lazy(() => import("./pages/SatelliteView"));

const DRAWER_WIDTH = 248;

export default function App() {
  const poll = useMetricsPoll(5_000);
  const data = poll.data;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <SideNav drawerWidth={DRAWER_WIDTH} />
      <TopBar
        scenarioId={data?.scenario_id ?? "(no scenario loaded)"}
        tickT={data?.t_seconds ?? 0}
        isLoading={poll.isLoading}
        onRefresh={poll.refetch}
        drawerWidth={DRAWER_WIDTH}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: "background.default",
          p: 4,
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 56, mb: 1 }} />

        <Routes>
          <Route path="/" element={<Overview poll={poll} />} />
          <Route path="/scenarios" element={<Scenarios refetchMetrics={poll.refetch} />} />
          <Route path="/beams" element={<Beams data={data} />} />
          <Route path="/gateways" element={<Gateways data={data} />} />
          <Route path="/anomalies" element={<Anomalies data={data} />} />
          <Route path="/copilot" element={<Copilot data={data} />} />
          <Route
            path="/satellite-view"
            element={
              <Suspense
                fallback={
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: "60vh",
                    }}
                  >
                    <CircularProgress />
                  </Box>
                }
              >
                <SatelliteView />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}
