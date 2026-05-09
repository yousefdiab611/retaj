const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  restartBackend: () => ipcRenderer.invoke("restart-backend"),
  getDeviceFingerprint: () => ipcRenderer.invoke("get-device-fingerprint"),
  getLocalLicense: () => ipcRenderer.invoke("get-local-license"),
  saveLocalLicense: (licenseData) => ipcRenderer.invoke("save-local-license", licenseData),
  isLocalLicenseValid: () => ipcRenderer.invoke("is-local-license-valid"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("quit-and-install-update"),
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
