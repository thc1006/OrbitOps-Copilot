import { Box, Toolbar } from "@mui/material";
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}
