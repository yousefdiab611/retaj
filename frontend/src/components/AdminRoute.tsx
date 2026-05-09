import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { getUser } from "@/lib/api";

export function AdminRoute({ children }: { children: ReactNode }) {
  const user = getUser();
  if (user?.role !== "ADMIN" && user?.role !== "TENANT_ADMIN" && user?.role !== "SUPER_ADMIN") {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
