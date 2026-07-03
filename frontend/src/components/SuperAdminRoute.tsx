import { Navigate } from "react-router-dom";

import { getUser } from "@/lib/api";

import type { ReactNode } from "react";

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const user = getUser();
  if (user?.role !== "SUPER_ADMIN") {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
