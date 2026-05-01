import { createTheme } from "@mui/material/styles";

/**
 * OrbitOps theme — Kubernetes-Dashboard-flavoured Material Design.
 *
 * Choices:
 *   - Primary `#326CE5`  : Kubernetes brand blue (the same hue you'll see
 *                         in k8s Dashboard's AppBar).
 *   - Secondary `#0F172A`: deep slate, used for the side-nav background to
 *                         match k8s Dashboard's "two-tone" chrome.
 *   - Status colours align with conventional ops pills: Material green /
 *                         amber / red.
 *   - Typography:
 *       - Display + body : Roboto (Material's canonical face — k8s
 *                          Dashboard uses it; matching the official feel).
 *       - Numerics       : JetBrains Mono Variable, applied per-component
 *                          to metric tables / badges so SNR columns align.
 */
export const orbitopsTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#326CE5",
      dark: "#1A4FB5",
      light: "#5C8DEF",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#0F172A",
      light: "#1E293B",
      contrastText: "#FFFFFF",
    },
    success: { main: "#16A34A", light: "#22C55E", dark: "#15803D" },
    warning: { main: "#D97706", light: "#F59E0B", dark: "#B45309" },
    error: { main: "#DC2626", light: "#EF4444", dark: "#B91C1C" },
    info: { main: "#0369A1", light: "#0EA5E9", dark: "#075985" },
    background: {
      default: "#F8FAFC",
      paper: "#FFFFFF",
    },
    divider: "#E2E8F0",
    text: {
      primary: "#0F172A",
      secondary: "#475569",
      disabled: "#94A3B8",
    },
  },
  shape: { borderRadius: 4 }, // tight corners — Material 3 / Dashboard density
  typography: {
    fontFamily:
      '"Roboto", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 500, letterSpacing: "-0.01em" },
    h2: { fontWeight: 500, letterSpacing: "-0.01em" },
    h3: { fontWeight: 500 },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500, fontSize: "1.125rem" },
    h6: { fontWeight: 500, fontSize: "1rem", letterSpacing: 0 },
    subtitle1: { fontWeight: 500, fontSize: "0.875rem" },
    subtitle2: { fontWeight: 500, fontSize: "0.8125rem", color: "#475569" },
    body1: { fontSize: "0.875rem" },
    body2: { fontSize: "0.8125rem", color: "#475569" },
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
    caption: { fontSize: "0.75rem", color: "#64748B" },
    overline: {
      fontSize: "0.6875rem",
      fontWeight: 500,
      letterSpacing: "0.08em",
    },
  },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: "#326CE5",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#0F172A",
          color: "#E2E8F0",
          borderRight: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, size: "small" },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: "#F1F5F9",
          fontSize: "0.8125rem",
        },
        head: {
          backgroundColor: "#F8FAFC",
          fontWeight: 600,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#475569",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #E2E8F0",
        },
      },
    },
    MuiChip: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: "0.6875rem",
          height: 22,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
  },
});

export const monoFamily =
  '"JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Consolas", monospace';
