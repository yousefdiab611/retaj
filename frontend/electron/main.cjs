const { app, BrowserWindow, Menu, ipcMain, dialog, crashReporter } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const { machineIdSync } = require("node-machine-id");
const { createHash } = require("crypto");

let mainWindow = null;
let backendProcess = null;
let Store = null;
let licenseStore = null;

async function importElectronStore() {
  if (!Store) {
    const module = await import("electron-store");
    Store = module.default ?? module;
  }
  return Store;
}

async function ensureLicenseStore() {
  if (licenseStore) return licenseStore;
  const StoreCtor = await importElectronStore();
  licenseStore = new StoreCtor({
    name: "license-store",
    encryptionKey: getLicenseEncryptionKey(),
    defaults: {
      license: null,
    },
  });
  return licenseStore;
}

function getLicenseEncryptionKey() {
  const seed = process.env.LICENSE_STORAGE_KEY || `${machineIdSync({ original: true })}:${app.getName()}`;
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

async function getLocalLicenseStore() {
  return await ensureLicenseStore();
}

async function getLocalLicense() {
  const store = await getLocalLicenseStore();
  return store.get("license", null);
}

async function saveLocalLicense(data) {
  const store = await getLocalLicenseStore();
  store.set("license", data);
}

async function isLocalLicenseValid() {
  const entry = await getLocalLicense();
  if (!entry || !entry.licenseKey || !entry.deviceId) return false;
  if (entry.deviceId !== machineIdSync({ original: true })) return false;
  if (!entry.expiresAt) return true;

  const expiresAt = new Date(entry.expiresAt);
  const now = new Date();
  if (expiresAt.getTime() >= now.getTime()) {
    return true;
  }
  if (entry.graceUntil) {
    const graceUntil = new Date(entry.graceUntil);
    return graceUntil.getTime() >= now.getTime();
  }
  return false;
}

const isDev = process.env.NODE_ENV === "development" || !!process.env.ELECTRON_START_URL;
const startUrl = isDev
  ? process.env.ELECTRON_START_URL || "http://localhost:5173"
  : `file://${path.join(__dirname, "../dist/index.html")}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    title: "Retaj Store",
    icon: path.join(__dirname, "../public/retaj-icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    stopBackend();
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }
}

function setupAutoUpdater() {
  if (isDev) return;

  if (process.env.UPDATE_SERVER_URL) {
    autoUpdater.setFeedURL({ provider: "generic", url: process.env.UPDATE_SERVER_URL });
  }

  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("Auto-updater: checking for updates");
  });
  autoUpdater.on("update-available", (info) => {
    console.log("Auto-updater: update available", info.version);
    mainWindow?.webContents.send("update-available", info);
  });
  autoUpdater.on("update-not-available", () => {
    console.log("Auto-updater: no update available");
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.log("Auto-updater: update downloaded", info.version);
    mainWindow?.webContents.send("update-downloaded", info);
  });
  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error);
    mainWindow?.webContents.send("update-error", { message: error == null ? "Unknown" : error.message });
  });
}

function startBackend() {
  if (isDev) {
    console.log("Development mode: assuming backend is running externally");
    return;
  }

  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, "backend", "dist", "index.js")
    : path.join(__dirname, "../../backend/dist/index.js");
  const backendCwd = app.isPackaged
    ? path.join(process.resourcesPath, "backend")
    : path.join(__dirname, "../../backend");
  const executable = app.isPackaged ? process.execPath : "node";

  backendProcess = spawn(executable, [backendPath], {
    cwd: backendCwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error);
    dialog.showErrorBox("Backend Error", "Unable to launch the backend server.");
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  await ensureLicenseStore();

  crashReporter.start({
    companyName: "RETAJ STORE",
    productName: "RETAJ STORE",
    uploadToServer: Boolean(process.env.CRASH_REPORT_URL),
    submitURL: process.env.CRASH_REPORT_URL || "",
    extra: {
      appVersion: app.getVersion(),
    },
  });

  setupAutoUpdater();
  startBackend();
  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdates();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

ipcMain.handle("get-app-version", () => app.getVersion());

ipcMain.handle("restart-backend", () => {
  stopBackend();
  setTimeout(startBackend, 1000);
});

ipcMain.handle("get-device-fingerprint", () => machineIdSync({ original: true }));
ipcMain.handle("get-local-license", () => getLocalLicense());
ipcMain.handle("save-local-license", (_event, licenseData) => saveLocalLicense(licenseData));
ipcMain.handle("is-local-license-valid", () => isLocalLicenseValid());
ipcMain.handle("check-for-updates", async () => {
  if (isDev) return { ok: false, error: "development" };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message ?? "unknown" };
  }
});
ipcMain.handle("quit-and-install-update", () => {
  autoUpdater.quitAndInstall();
});

app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
    require("electron").shell.openExternal(navigationUrl);
  });
});
