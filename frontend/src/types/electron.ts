export type LocalLicenseData = {
  licenseKey: string;
  deviceId: string;
  deviceFingerprint: string;
  status: string;
  expiresAt: string | null;
  trialMode: boolean;
  graceRemainingDays: number;
  graceUntil?: string | null;
  activatedAt?: string;
  lastValidatedAt?: string;
};

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  restartBackend: () => Promise<void>;
  getDeviceFingerprint: () => Promise<string>;
  getLocalLicense: () => Promise<LocalLicenseData | null>;
  saveLocalLicense: (licenseData: LocalLicenseData | null) => Promise<void>;
  isLocalLicenseValid: () => Promise<boolean>;
  checkForUpdates: () => Promise<{ ok: boolean; error?: string }>;
  installUpdate: () => Promise<void>;
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
