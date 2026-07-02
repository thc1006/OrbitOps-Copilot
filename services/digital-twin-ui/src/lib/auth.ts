// Token storage helpers for OrbitOps JWT auth.
// Key: localStorage.orbitops_token (AC-S003-VS19.10)
const TOKEN_KEY = "orbitops_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
