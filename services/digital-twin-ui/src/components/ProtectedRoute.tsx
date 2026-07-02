// ProtectedRoute — redirects unauthenticated users to /login.
// Used in App.tsx to guard the main layout.
// AC-S003-VS19.10: check token; if absent → Navigate to /login.
import { Navigate } from "react-router-dom";
import { getToken } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
