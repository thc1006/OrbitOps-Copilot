import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Alert, AlertTitle, Box, Button, Paper, Stack, Typography } from "@mui/material";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";

import { monoFamily } from "../theme";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level safety net. If any descendant throws during render or in a
 * lifecycle method, surface a Material-styled fallback panel with the
 * error message + a Reload button — instead of letting the whole app
 * white-screen.
 *
 * React 18 still requires a class component for componentDidCatch +
 * getDerivedStateFromError; the rest of the codebase is functional.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the boundary capture in the console so devtools see the
    // full stack — the in-app panel only shows the message.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = (): void => {
    this.setState({ error: null });
    // Hard reload: drops in-memory state including the polling hook,
    // which is the right thing if the underlying schema drifted under us.
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ p: 4, maxWidth: 720, mx: "auto" }}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Alert severity="error">
              <AlertTitle>Application error</AlertTitle>
              The OrbitOps UI hit an unexpected error and stopped rendering.
              Reloading the page will recover; if it recurs, please file an
              issue with the message below.
            </Alert>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: "grey.50",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                fontFamily: monoFamily,
                fontSize: "0.75rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "error.dark",
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                onClick={this.handleReload}
                startIcon={<RestartAltRoundedIcon />}
              >
                Reload page
              </Button>
              <Typography
                variant="caption"
                sx={{ alignSelf: "center", color: "text.secondary" }}
              >
                Hint: visit /scenarios to re-load a scenario after reload.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }
}
