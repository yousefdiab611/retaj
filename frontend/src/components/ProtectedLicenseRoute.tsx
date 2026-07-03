import { DesktopLicenseGate } from "@/components/DesktopLicenseGate";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import type { ReactNode } from "react";

export function ProtectedLicenseRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <DesktopLicenseGate>{children}</DesktopLicenseGate>
    </ProtectedRoute>
  );
}
