// Roboto + JetBrains Mono font subsets (loaded at app boot so the AppBar
// renders with the right face on first paint).
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource-variable/jetbrains-mono";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { initI18n } from "./i18n";
import { orbitopsTheme } from "./theme";

// T1 — bootstrap i18n before the React tree mounts so useTranslation()
// returns real strings on first paint instead of bare keys. The init is
// async but i18next handles synchronous resource bundles immediately;
// awaiting just makes ordering deterministic in tests.
void initI18n();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ThemeProvider theme={orbitopsTheme}>
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
