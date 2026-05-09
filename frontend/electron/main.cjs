/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Retaj Store - Electron main process
 *
 * Standalone Windows desktop topology:
 *   - SQLite database file lives under app.getPath('userData')/retaj.db
 *   - JWT_SECRET is generated once and persisted in an encrypted store
 *     (keyed by the machine fingerprint so credentials don't survive
 *     being copied to a different physical PC)
 *   - The Node.js backend (Express + Prisma) runs as a child process
 *     using ELECTRON_RUN_AS_NODE so we don't have to ship a separate
 *     Node binary inside the installer
 *   - Prisma `migrate deploy` is run on first launch (and again after
 *     auto-updates) so existing customer data is upgraded in-place
 */
const { app, BrowserWindow, Menu, ipcMain, dialog, crashReporter, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const { autoUpdater } = require("electron-updater");
const { machineIdSync } = require("node-machine-id");
const { createHash, randomBytes } = require("crypto");

const BACKEND_PORT = Number(process.env.RETAJ_BACKEND_PORT) || 38217;
const BACKEND_READY_TIMEOUT_MS = 30_000;
const BACKEND_HEALTH_PATH = "/health";

let mainWindow = null;
let backendProcess = null;
let backendReady = false;
let Store = null;
let licenseStore = null;
let secretStore = null;

// ---------------------------------------------------------------------------
// Encrypted local stores (license + machine-bound secrets)
// ---------------------------------------------------------------------------

async function importElectronStore() {
  if (!Store) {
    const moduleRef = await import("electron-store");
    Store = moduleRef.default ?? moduleRef;
  }
  return Store;
}

function getStorageEncryptionKey(seedSalt) {
  const seed = process.env.LICENSE_STORAGE_KEY || `${machineIdSync({ original: true })}:${app.getName()}:${seedSalt}`;
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

async function ensureLicenseStore() {
  if (licenseStore) return licenseStore;
  const StoreCtor = await importElectronStore();
  licenseStore = new StoreCtor({
    name: "license-store",
    encryptionKey: getStorageEncryptionKey("license"),
    defaults: { license: null },
  });
  return licenseStore;
}

async function ensureSecretStore() {
  if (secretStore) return secretStore;
  const StoreCtor = await importElectronStore();
  secretStore = new StoreCtor({
    name: "retaj-secrets",
    encryptionKey: getStorageEncryptionKey("secrets"),
    defaults: {},
  });
  return secretStore;
}

async function getOrCreateJwtSecret() {
  const store = await ensureSecretStore();
  const existing = store.get("jwtSecret");
  if (typeof existing === "string" && existing.length >= 32) return existing;
  const fresh = randomBytes(48).toString("hex");
  store.set("jwtSecret", fresh);
  return fresh;
}

async function getLocalLicense() {
  const store = await ensureLicenseStore();
  return store.get("license", null);
}

async function saveLocalLicense(data) {
  const store = await ensureLicenseStore();
  store.set("license", data);
}

async function isLocalLicenseValid() {
  const entry = await getLocalLicense();
  if (!entry || !entry.licenseKey || !entry.deviceId) return false;
  if (entry.deviceId !== machineIdSync({ original: true })) return false;
  if (!entry.expiresAt) return true;
  const expiresAt = new Date(entry.expiresAt);
  const now = new Date();
  if (expiresAt.getTime() >= now.getTime()) return true;
  if (entry.graceUntil) {
    const graceUntil = new Date(entry.graceUntil);
    return graceUntil.getTime() >= now.getTime();
  }
  return false;
}

// ---------------------------------------------------------------------------
// Backend lifecycle (Node child process via ELECTRON_RUN_AS_NODE)
// ---------------------------------------------------------------------------

function resolveBackendPaths() {
  if (app.isPackaged) {
    const resourcesBackend = path.join(process.resourcesPath, "backend");
    return {
      cwd: resourcesBackend,
      entry: path.join(resourcesBackend, "dist", "index.js"),
      prismaSchema: path.join(resourcesBackend, "prisma-desktop", "schema.prisma"),
      prismaCli: path.join(resourcesBackend, "node_modules", "prisma", "build", "index.js"),
    };
  }
  const devBackend = path.resolve(__dirname, "..", "..", "backend");
  return {
    cwd: devBackend,
    entry: path.join(devBackend, "dist", "index.js"),
    prismaSchema: path.join(devBackend, "prisma-desktop", "schema.prisma"),
    prismaCli: path.join(devBackend, "node_modules", "prisma", "build", "index.js"),
  };
}

function getDesktopDataDir() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDesktopDatabaseUrl() {
  const dbFile = path.join(getDesktopDataDir(), "retaj.db");
  // Prisma's SQLite URL needs file:/// triple slash on absolute paths.
  return `file:${dbFile}`;
}

async function buildBackendEnv() {
  const jwtSecret = await getOrCreateJwtSecret();
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(BACKEND_PORT),
    HOST: "127.0.0.1",
    DATABASE_PROVIDER: "sqlite",
    DATABASE_URL: getDesktopDatabaseUrl(),
    JWT_SECRET: jwtSecret,
    LOG_LEVEL: "info",
    LOG_PRETTY: "0",
    DISABLE_SCHEDULED_BACKUPS: "1",
    DB_DOCKER_RECOVERY: "0",
    ALLOWED_ORIGINS: "*",
    TRUST_PROXY: "0",
    // No Redis / Stripe in standalone desktop mode.
    REDIS_URL: "",
    STRIPE_SECRET_KEY: "",
  };
}

function runPrismaDeploy(env, paths) {
  if (!fs.existsSync(paths.prismaCli)) {
    console.warn("[bootstrap] prisma CLI not found at", paths.prismaCli);
    return;
  }
  if (!fs.existsSync(paths.prismaSchema)) {
    console.warn("[bootstrap] prisma desktop schema not found at", paths.prismaSchema);
    return;
  }
  console.log("[bootstrap] running prisma migrate deploy");
  const result = spawnSync(process.execPath, [paths.prismaCli, "migrate", "deploy", `--schema=${paths.prismaSchema}`], {
    cwd: paths.cwd,
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error("[bootstrap] migrate deploy failed", result.stdout, result.stderr);
    dialog.showErrorBox(
      "Database setup failed",
      "Could not initialise the local database. The application will close.\n\n" +
        (result.stderr || result.stdout || "Unknown error"),
    );
    app.exit(1);
    return;
  }
  console.log(result.stdout?.trim());
}

async function waitForBackendHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-undef
  const fetcher = typeof fetch === "function" ? fetch : null;
  while (Date.now() < deadline) {
    try {
      if (fetcher) {
        const resp = await fetcher(`http://127.0.0.1:${BACKEND_PORT}${BACKEND_HEALTH_PATH}`);
        if (resp.ok) {
          backendReady = true;
          return true;
        }
      }
    } catch {
      // backend not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function startBackend() {
  if (isDev) {
    console.log("[backend] dev mode, expecting external backend on :3001");
    backendReady = true;
    return;
  }
  const paths = resolveBackendPaths();
  if (!fs.existsSync(paths.entry)) {
    dialog.showErrorBox("Missing backend", `Backend bundle not found at ${paths.entry}`);
    app.exit(1);
    return;
  }
  const env = await buildBackendEnv();
  runPrismaDeploy(env, paths);

  console.log(`[backend] launching ${paths.entry}`);
  backendProcess = spawn(process.execPath, [paths.entry], {
    cwd: paths.cwd,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  backendProcess.stdout.on("data", (chunk) => process.stdout.write(`[backend] ${chunk}`));
  backendProcess.stderr.on("data", (chunk) => process.stderr.write(`[backend!] ${chunk}`));
  backendProcess.on("close", (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
    backendReady = false;
  });
  backendProcess.on("error", (err) => {
    console.error("[backend] failed to start", err);
    dialog.showErrorBox("Backend error", err.message ?? "Unable to launch the local server.");
  });

  const ok = await waitForBackendHealth(BACKEND_READY_TIMEOUT_MS);
  if (!ok) {
    dialog.showErrorBox(
      "Server timeout",
      `The local backend did not respond within ${BACKEND_READY_TIMEOUT_MS / 1000}s.`,
    );
  }
}

function stopBackend() {
  if (!backendProcess) return;
  try {
    backendProcess.kill();
  } catch (err) {
    console.warn("[backend] kill error", err);
  }
  backendProcess = null;
  backendReady = false;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === "development" || !!process.env.ELECTRON_START_URL;
const startUrl = isDev
  ? process.env.ELECTRON_START_URL || "http://localhost:5173"
  : `file://${path.join(__dirname, "../dist/index.html")}`;

function getApiBaseForRenderer() {
  return `http://127.0.0.1:${BACKEND_PORT}`;
}

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
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [`--retaj-api=${getApiBaseForRenderer()}`],
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
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }
}

// ---------------------------------------------------------------------------
// Auto-updater
// ---------------------------------------------------------------------------

function setupAutoUpdater() {
  if (isDev) return;
  if (process.env.UPDATE_SERVER_URL) {
    autoUpdater.setFeedURL({ provider: "generic", url: process.env.UPDATE_SERVER_URL });
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-available", (info) => mainWindow?.webContents.send("update-available", info));
  autoUpdater.on("update-downloaded", (info) => mainWindow?.webContents.send("update-downloaded", info));
  autoUpdater.on("error", (error) =>
    mainWindow?.webContents.send("update-error", { message: error?.message ?? "Unknown" }),
  );
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-api-base-url", () => getApiBaseForRenderer());
ipcMain.handle("get-backend-status", () => ({ ready: backendReady, port: BACKEND_PORT }));
ipcMain.handle("restart-backend", async () => {
  stopBackend();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await startBackend();
  return { ok: backendReady };
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
ipcMain.handle("quit-and-install-update", () => autoUpdater.quitAndInstall());
ipcMain.handle("open-data-folder", () => shell.openPath(getDesktopDataDir()));

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  await ensureLicenseStore();
  await ensureSecretStore();

  crashReporter.start({
    companyName: "Retaj Store",
    productName: "Retaj Store",
    uploadToServer: Boolean(process.env.CRASH_REPORT_URL),
    submitURL: process.env.CRASH_REPORT_URL || "",
    extra: { appVersion: app.getVersion() },
  });

  setupAutoUpdater();
  await startBackend();
  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdates().catch((err) => console.warn("[updater]", err));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBackend());

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
});
