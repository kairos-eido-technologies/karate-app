const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const net = require("net");
const { fork } = require("child_process");
const fs = require("fs");

const PORT = process.env.PORT || 3050;
let LOG_PATH;
try {
  LOG_PATH = path.join(app.getPath("appData"), "DojoManager", "app-debug.log");
} catch {
  LOG_PATH = path.join(process.cwd(), "dojo-debug.log");
}

function writeLog(msg) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

let serverProcess = null;
let mainWindow = null;

function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryConnect = () => {
      attempts++;
      const sock = new net.Socket();
      sock.once("connect", () => { sock.destroy(); resolve(); });
      sock.once("error", () => {
        sock.destroy();
        if (attempts >= retries) return reject(new Error("Server failed to start"));
        setTimeout(tryConnect, 1000);
      });
      sock.connect(port, "127.0.0.1");
    };
    tryConnect();
  });
}

function startServer() {
  const possiblePaths = [
    path.join(__dirname, "../.output/server/index.mjs"),
    path.join(process.cwd(), ".output/server/index.mjs"),
  ];
  const serverPath = possiblePaths.find(p => fs.existsSync(p));
  if (!serverPath) {
    writeLog(`Server not found in candidate paths: ${possiblePaths.join(", ")}`);
    return;
  }

  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: String(PORT), NITRO_PORT: String(PORT), HOST: "0.0.0.0" },
    stdio: "pipe",
  });
  serverProcess.stdout?.on("data", (d) => writeLog(`[server] ${d.toString().trim()}`));
  serverProcess.stderr?.on("data", (d) => writeLog(`[server:err] ${d.toString().trim()}`));
  writeLog("Server process forked successfully");
}

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const splash = new BrowserWindow({
    width: 420, height: 280, frame: false, alwaysOnTop: true, transparent: true,
    webPreferences: { nodeIntegration: false },
  });
  splash.loadURL("data:text/html,<body style='background:%238B1A1A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:white;flex-direction:column;border-radius:16px;'><h1 style='font-size:2.2rem;font-weight:900;margin:0 0 8px'>🥋 DOJO MANAGER</h1><p style='color:%23F5F0E8;font-size:14px;margin:0'>Starting Karate Management Console...</p></body>");

  mainWindow = new BrowserWindow({
    width, height, show: false,
    title: "Dojo Manager — Karate Academy Management System",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());
  ipcMain.handle("window:toggle-fullscreen", () =>
    mainWindow?.setFullScreen(!mainWindow?.isFullScreen())
  );

  const isRunning = await new Promise(resolve => {
    const s = new net.Socket();
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => { s.destroy(); resolve(false); });
    s.connect(PORT, "127.0.0.1");
  });

  if (!isRunning) {
    startServer();
    try {
      await waitForServer(PORT);
      writeLog("Server ready");
    } catch (e) {
      writeLog(`Server wait error: ${e}`);
    }
  } else {
    writeLog("Server already active on port " + PORT);
  }

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.maximize();
  mainWindow.once("ready-to-show", () => {
    splash.destroy();
    mainWindow?.show();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });
}
