import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DesktopLicenseGate } from "@/components/DesktopLicenseGate";

export function ProtectedLicenseRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <DesktopLicenseGate>{children}</DesktopLicenseGate>
    </ProtectedRoute>
  );
}
