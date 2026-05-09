import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { ReactNode } from "react";

import { validateLicense } from "@/lib/api";
import { getDeviceFingerprint, getLocalLicense, isDesktopApp, isLocalLicenseValid } from "@/lib/electron";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";

export function DesktopLicenseGate({ children }: { children: ReactNode }) {
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const location = useLocation();
  const online = useOnlineStatus();

  useEffect(() => {
    let mounted = true;

    async function checkLicense() {
      if (!isDesktopApp()) {
        if (!mounted) return;
        setAllowed(true);
        setLicenseChecked(true);
        return;
      }

      try {
        const localValid = await isLocalLicenseValid();
        if (!mounted) return;
        if (!localValid) {
          setAllowed(false);
          setLicenseChecked(true);
          return;
        }

        const localLicense = await getLocalLicense();
        if (!mounted) return;
        if (!localLicense?.licenseKey) {
          setAllowed(false);
          setLicenseChecked(true);
          return;
        }

        const deviceId = await getDeviceFingerprint();
        if (!mounted) return;
        if (!deviceId) {
          setAllowed(false);
          setLicenseChecked(true);
          return;
        }

        if (!navigator.onLine) {
          setAllowed(true);
          setLicenseChecked(true);
          return;
        }

        try {
          await validateLicense(localLicense.licenseKey, deviceId, deviceId);
          if (!mounted) return;
          setAllowed(true);
        } catch {
          if (!mounted) return;
          setAllowed(false);
        }
      } catch {
        if (!mounted) return;
        setAllowed(false);
      } finally {
        if (mounted) {
          setLicenseChecked(true);
        }
      }
    }

    void checkLicense();

    return () => {
      mounted = false;
    };
  }, [location.pathname, online]);

  if (!licenseChecked) {
    return null;
  }

  if (!allowed) {
    return <Navigate to="/license" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
