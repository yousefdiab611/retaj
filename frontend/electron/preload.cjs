/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

function readApiArg() {
  const arg = (process.argv ?? []).find((entry) => typeof entry === "string" && entry.startsWith("--retaj-api="));
  if (!arg) return null;
  return arg.slice("--retaj-api=".length);
}

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getApiBaseUrl: () => ipcRenderer.invoke("get-api-base-url"),
  getBackendStatus: () => ipcRenderer.invoke("get-backend-status"),
  restartBackend: () => ipcRenderer.invoke("restart-backend"),
  getDeviceFingerprint: () => ipcRenderer.invoke("get-device-fingerprint"),
  getLocalLicense: () => ipcRenderer.invoke("get-local-license"),
  saveLocalLicense: (licenseData) => ipcRenderer.invoke("save-local-license", licenseData),
  isLocalLicenseValid: () => ipcRenderer.invoke("is-local-license-valid"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("quit-and-install-update"),
  openDataFolder: () => ipcRenderer.invoke("open-data-folder"),
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

contextBridge.exposeInMainWorld("__RETAJ_BOOT__", {
  apiBaseUrl: readApiArg(),
});
