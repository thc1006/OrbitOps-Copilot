// Login page — AC-S003-VS19.10
// Calls mock-oidc /orbitops/token with form-login credentials,
// stores access_token under localStorage.orbitops_token, then
// navigates to /.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { setToken } from "../lib/auth";
import { OIDC_BASE } from "../lib/axiosInstance";

// Vite replaces `import.meta.env.DEV` with a boolean literal at build time; in a
// production build it is `false`, so esbuild eliminates the dev-bypass handler
// body and the button below. The cast matches the codebase idiom for reading
// import.meta.env without vite/client global types (see api.ts/axiosInstance.ts).
const IS_DEV = (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV;

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("username", username);
      params.append("password", password);
      const resp = await axios.post(
        `${OIDC_BASE}/orbitops/token`,
        params,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      setToken((resp.data as { access_token: string }).access_token);
      navigate("/");
    } catch {
      setError(t("auth.login.error"));
    } finally {
      setLoading(false);
    }
  };

  // Dev-only escape hatch: skips the OIDC flow so contributors can reach the
  // dashboard without a running IdP. `import.meta.env.DEV` is false in prod
  // builds, so Vite tree-shakes both this handler body and the button below —
  // the bypass never ships to production.
  const handleDevBypass = () => {
    if (!IS_DEV) return;
    setToken("dev-bypass-token");
    navigate("/");
  };

  return (
    <Box
      component="form"
      onSubmit={handleLogin}
      sx={{
        maxWidth: 400,
        mx: "auto",
        mt: 8,
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography variant="h5">{t("auth.login.title")}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label={t("auth.login.username")}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <TextField
        label={t("auth.login.password")}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" variant="contained" disabled={loading}>
        {loading ? t("auth.login.loggingIn") : t("auth.login.submit")}
      </Button>
      {IS_DEV && (
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          onClick={handleDevBypass}
          sx={{ mt: 1 }}
        >
          {t("auth.login.devBypass")}
        </Button>
      )}
    </Box>
  );
}
