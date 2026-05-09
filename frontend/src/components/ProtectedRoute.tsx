import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { clearSession, ensureDefaultBranchSelection, getToken, getUser } from "@/lib/api";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  const user = getUser();
  if (!user) {
    clearSession();
    return <Navigate to="/login" replace />;
  }
  ensureDefaultBranchSelection(user);
  return children;
}
