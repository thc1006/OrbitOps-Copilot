// Axios instance for copilot-api requests.
// AC-S003-VS19.11: request interceptor injects Authorization: Bearer <token>
// AC-S003-VS19.12: response interceptor clears token + redirects on 401
import axios from "axios";
import { clearToken, getToken } from "./auth";

const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;

// Guard against jsdom's `about:blank` which produces an invalid URL.
// In real browsers window.location.protocol is always "http:" or "https:".
const protocol =
  typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)
    ? window.location.protocol
    : "http:";
const hostname =
  typeof window !== "undefined" && window.location.hostname !== ""
    ? window.location.hostname
    : "localhost";

export const COPILOT_BASE =
  env.VITE_COPILOT_BASE_URL ?? `${protocol}//${hostname}:30081`;

export const OIDC_BASE =
  env.VITE_OIDC_BASE_URL ?? "http://localhost:9090";

export const copilotAxios = axios.create({ baseURL: COPILOT_BASE });

// AC-S003-VS19.11: inject bearer token on every request
copilotAxios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// AC-S003-VS19.12: on 401, clear token and redirect to /login
copilotAxios.interceptors.response.use(
  (response) => response,
  (error: { response?: { status: number } }) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
