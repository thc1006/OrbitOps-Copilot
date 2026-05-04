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
// returns real strings on first paint instead of bare keys. The init
// is async but i18next handles synchronous resource bundles
// immediately, so by the time React's first effect tick runs the t()
// calls already resolve.
//
// I-16 (PR for issue #71, 2026-05-04): the previous `void initI18n()`
// silently swallowed any rejection. Today the bundles are static
// imports so they can't fail — but if a future PR adds an async
// backend (i18next-http-backend, locize, lazy chunks), a rejected
// promise would disappear into the void. .catch() logs the failure
// so it's visible during development. We do NOT chain createRoot
// inside .then() because i18next's static-bundle init resolves
// synchronously enough that React mount races in parallel without
// seeing bare keys.
//
// PR #80 review (issue #80 review #3, 2026-05-04): direct console.error
// here is consistent with the existing convention in src/ — only
// ErrorBoundary.tsx logs directly to console (verified by
// `grep -rIn 'console\\.error' src/`). When a centralized logger
// lands (tracked in todo_list.md follow-up), both sites should
// migrate together; for now keeping them aligned.
initI18n().catch((err) => {
  console.error("[i18n] bootstrap failed:", err);
});

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
