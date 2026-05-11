import type { LocalLicenseData } from "@/types/electron";

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

/**
 * Whether the desktop build should enforce its license activation flow.
 *
 * The standalone POS ships with licensing DISABLED — it runs entirely
 * offline on a single PC and there is no cloud entitlement to verify.
 * Set `VITE_REQUIRE_DESKTOP_LICENSE=1` at build time to opt back in (e.g.
 * for an enterprise channel that does enforce online activation).
 */
export function isLicensingEnabled(): boolean {
  const flag = import.meta.env.VITE_REQUIRE_DESKTOP_LICENSE;
  return flag === "1" || flag === "true";
}

export function getDeviceFingerprint(): Promise<string | null> {
  return window.electronAPI?.getDeviceFingerprint() ?? Promise.resolve(null);
}

export function getLocalLicense(): Promise<LocalLicenseData | null> {
  return window.electronAPI?.getLocalLicense() ?? Promise.resolve(null);
}

export function saveLocalLicense(licenseData: LocalLicenseData | null): Promise<void> {
  return window.electronAPI?.saveLocalLicense(licenseData) ?? Promise.resolve();
}

export function isLocalLicenseValid(): Promise<boolean> {
  return window.electronAPI?.isLocalLicenseValid() ?? Promise.resolve(true);
}
