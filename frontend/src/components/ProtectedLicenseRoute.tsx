import type { ReactNode } from "react";

import { DesktopLicenseGate } from "@/components/DesktopLicenseGate";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export function ProtectedLicenseRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <DesktopLicenseGate>{children}</DesktopLicenseGate>
    </ProtectedRoute>
  );
}
