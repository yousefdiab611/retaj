import { Navigate } from "react-router-dom";

import { getUser } from "@/lib/api";

import type { ReactNode } from "react";

export function ManagerRoute({ children }: { children: ReactNode }) {
  const user = getUser();
  if (
    user?.role !== "ADMIN" &&
    user?.role !== "MANAGER" &&
    user?.role !== "TENANT_ADMIN" &&
    user?.role !== "SUPER_ADMIN"
  ) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
