/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Retaj Store - Electron main process
 *
 * Standalone Windows desktop topology:
 *   - SQLite database file lives under app.getPath('userData')/data/retaj.db
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
const BACKEND_READY_TIMEOUT_MS = Number(process.env.RETAJ_BACKEND_TIMEOUT_MS) || 90_000;
const BACKEND_HEALTH_PATH = "/health";

let mainWindow = null;
let backendProcess = null;
let backendReady = false;
let backendLastError = null;
let logStream = null;
let logFilePath = null;
let Store = null;
let licenseStore = null;
let secretStore = null;

// ---------------------------------------------------------------------------
// Diagnostic logging (file + console)
// ---------------------------------------------------------------------------

function ensureLogStream() {
  if (logStream) return;
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, "electron-main.log");
    logStream = fs.createWriteStream(logFilePath, { flags: "a" });
    logStream.write(`\n\n===== launch ${new Date().toISOString()} =====\n`);
    logStream.write(`app version : ${app.getVersion()}\n`);
    logStream.write(`process.execPath: ${process.execPath}\n`);
    logStream.write(`process.resourcesPath: ${process.resourcesPath}\n`);
    logStream.write(`app.isPackaged: ${app.isPackaged}\n`);
    logStream.write(`platform: ${process.platform} ${process.arch}\n`);
    logStream.write(`node: ${process.versions.node} electron: ${process.versions.electron}\n`);
  } catch (err) {
    console.error("could not open log stream", err);
  }
}

function diag(level, message, extra) {
  ensureLogStream();
  const line = `[${new Date().toISOString()}] [${level}] ${message}${
    extra ? " " + (typeof extra === "string" ? extra : JSON.stringify(extra)) : ""
  }`;
  if (logStream) logStream.write(line + "\n");
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

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
  const seed =
    process.env.LICENSE_STORAGE_KEY || `${machineIdSync({ original: true })}:${app.getName()}:${seedSalt}`;
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
      nodeModules: path.join(resourcesBackend, "node_modules"),
    };
  }
  const devBackend = path.resolve(__dirname, "..", "..", "backend");
  return {
    cwd: devBackend,
    entry: path.join(devBackend, "dist", "index.js"),
    prismaSchema: path.join(devBackend, "prisma-desktop", "schema.prisma"),
    prismaCli: path.join(devBackend, "node_modules", "prisma", "build", "index.js"),
    nodeModules: path.join(devBackend, "node_modules"),
  };
}

function getDesktopDataDir() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDesktopDatabaseUrl() {
  const dbFile = path.join(getDesktopDataDir(), "retaj.db");
  // Prisma's SQLite URL accepts forward slashes everywhere; backslashes
  // would otherwise need shell escaping when the user data path lives on
  // a drive letter with spaces (e.g. "C:\Users\Joe\AppData\Roaming\Retaj Store").
  return `file:${dbFile.replace(/\\/g, "/")}`;
}

function getBackendLogFilePath() {
  // Pino MUST write somewhere user-writable. The packaged backend's cwd
  // sits under Program Files (read-only on Windows), so we explicitly
  // redirect the API log into the per-user data directory next to the DB.
  const dir = path.join(app.getPath("userData"), "logs");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // best effort; the backend will fall back to stdout if the file is
    // not openable.
  }
  return path.join(dir, "retaj-api.log");
}

async function buildBackendEnv() {
  const jwtSecret = await getOrCreateJwtSecret();
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(BACKEND_PORT),
    HOST: "127.0.0.1",
    DATABASE_PROVIDER: "sqlite",
    DATABASE_URL: getDesktopDatabaseUrl(),
    JWT_SECRET: jwtSecret,
    LOG_LEVEL: "info",
    LOG_PRETTY: "0",
    LOG_FILE_PATH: getBackendLogFilePath(),
    DISABLE_SCHEDULED_BACKUPS: "1",
    DB_DOCKER_RECOVERY: "0",
    ALLOWED_ORIGINS: "*",
    TRUST_PROXY: "0",
    REDIS_URL: "",
    STRIPE_SECRET_KEY: "",
  };
  // Make sure node never tries to look up modules outside our bundled tree.
  delete env.NODE_OPTIONS;
  return env;
}

function runPrismaDeploy(env, paths) {
  if (!fs.existsSync(paths.prismaCli)) {
    diag("warn", "prisma CLI not found, skipping migrate deploy", { prismaCli: paths.prismaCli });
    return true;
  }
  if (!fs.existsSync(paths.prismaSchema)) {
    diag("warn", "prisma desktop schema not found, skipping migrate deploy", {
      prismaSchema: paths.prismaSchema,
    });
    return true;
  }
  diag("info", "running prisma migrate deploy", { schema: paths.prismaSchema });
  const result = spawnSync(
    process.execPath,
    [paths.prismaCli, "migrate", "deploy", `--schema=${paths.prismaSchema}`],
    {
      cwd: paths.cwd,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: "1",
      },
      encoding: "utf8",
    },
  );
  if (result.stdout) diag("info", "[prisma stdout]", result.stdout.trim());
  if (result.stderr) diag("warn", "[prisma stderr]", result.stderr.trim());
  if (result.status !== 0) {
    diag("error", "prisma migrate deploy failed", { status: result.status });
    return false;
  }
  diag("info", "prisma migrate deploy completed");
  return true;
}

async function waitForBackendHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const fetcher = typeof fetch === "function" ? fetch : null;
  let lastStatus = null;
  while (Date.now() < deadline) {
    if (!backendProcess) {
      diag("error", "backend process exited before becoming healthy");
      return false;
    }
    try {
      if (fetcher) {
        const resp = await fetcher(`http://127.0.0.1:${BACKEND_PORT}${BACKEND_HEALTH_PATH}`);
        lastStatus = resp.status;
        if (resp.ok) {
          backendReady = true;
          diag("info", "backend is healthy", { status: resp.status, port: BACKEND_PORT });
          return true;
        }
      }
    } catch (err) {
      backendLastError = err?.message ?? String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  diag("error", "backend health probe timed out", {
    timeoutMs,
    lastStatus,
    lastError: backendLastError,
  });
  return false;
}

async function startBackend() {
  if (isDev) {
    diag("info", "dev mode, expecting external backend on :3001");
    backendReady = true;
    return;
  }
  const paths = resolveBackendPaths();
  diag("info", "backend paths resolved", paths);

  for (const [key, p] of Object.entries(paths)) {
    if (key === "cwd" || key === "nodeModules") continue;
    if (!fs.existsSync(p)) {
      diag("error", `required file missing: ${key}`, { path: p });
    }
  }

  if (!fs.existsSync(paths.entry)) {
    showFatalDialog(
      "Backend entry missing",
      `The backend bundle was not packaged correctly.\n\nExpected at:\n${paths.entry}`,
    );
    return;
  }

  const env = await buildBackendEnv();
  diag("info", "backend env prepared", {
    DATABASE_URL: env.DATABASE_URL,
    PORT: env.PORT,
    DATABASE_PROVIDER: env.DATABASE_PROVIDER,
  });

  const migrateOk = runPrismaDeploy(env, paths);
  if (!migrateOk) {
    showFatalDialog(
      "Database setup failed",
      `Prisma could not initialise the local database.\n\nSee log:\n${logFilePath}`,
    );
    return;
  }

  diag("info", `spawning backend ${paths.entry}`);
  backendProcess = spawn(process.execPath, [paths.entry], {
    cwd: paths.cwd,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  backendProcess.stdout.on("data", (chunk) => {
    const s = chunk.toString().trimEnd();
    diag("info", "[backend stdout]", s);
  });
  backendProcess.stderr.on("data", (chunk) => {
    const s = chunk.toString().trimEnd();
    diag("warn", "[backend stderr]", s);
  });
  backendProcess.on("close", (code, signal) => {
    diag("warn", "backend exited", { code, signal });
    backendProcess = null;
    backendReady = false;
  });
  backendProcess.on("error", (err) => {
    diag("error", "backend spawn error", { message: err?.message ?? String(err) });
    backendLastError = err?.message ?? String(err);
  });

  const ok = await waitForBackendHealth(BACKEND_READY_TIMEOUT_MS);
  if (!ok) {
    showFatalDialog(
      "Server timeout",
      `The local backend did not respond within ${Math.round(
        BACKEND_READY_TIMEOUT_MS / 1000,
      )}s.\n\nSee log for details:\n${logFilePath}\n\nLast error: ${backendLastError ?? "n/a"}`,
    );
  }
}

function stopBackend() {
  if (!backendProcess) return;
  try {
    backendProcess.kill();
  } catch (err) {
    diag("warn", "kill error", { message: err?.message ?? String(err) });
  }
  backendProcess = null;
  backendReady = false;
}

function showFatalDialog(title, message) {
  diag("error", `${title}: ${message.replace(/\n/g, " ")}`);
  try {
    dialog.showErrorBox(title, message);
  } catch {
    // dialog may be unavailable very early in startup
  }
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

  // Always allow opening DevTools manually so packaged-app issues stay
  // diagnosable (F12 / Ctrl+Shift+I / Cmd+Alt+I).
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.type !== "keyDown") return;
    const key = (input.key || "").toLowerCase();
    const togglesDevTools =
      key === "f12" ||
      ((input.control || input.meta) && input.shift && key === "i") ||
      (input.meta && input.alt && key === "i");
    if (togglesDevTools) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // If the renderer crashes or fails to load any asset, surface a hint
  // instead of leaving the window blank.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    diag("error", "renderer did-fail-load", { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    diag("error", "renderer process gone", details);
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      diag("warn", `[renderer console] ${message}`, { line, sourceId });
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

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
ipcMain.handle("get-backend-status", () => ({
  ready: backendReady,
  port: BACKEND_PORT,
  lastError: backendLastError,
  logFile: logFilePath,
}));
ipcMain.handle("restart-backend", async () => {
  stopBackend();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await startBackend();
  return { ok: backendReady, error: backendLastError };
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
ipcMain.handle("open-log-folder", () => {
  const dir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

process.on("uncaughtException", (err) => {
  diag("error", "uncaughtException in main", { message: err?.message ?? String(err), stack: err?.stack });
});
process.on("unhandledRejection", (reason) => {
  diag("error", "unhandledRejection in main", { reason: reason?.message ?? String(reason) });
});

app.whenReady().then(async () => {
  ensureLogStream();
  diag("info", "app ready");

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
    autoUpdater.checkForUpdates().catch((err) => diag("warn", "updater error", { message: err?.message }));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
