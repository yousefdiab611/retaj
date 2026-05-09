import type { LocalLicenseData } from "@/types/electron";

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
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
