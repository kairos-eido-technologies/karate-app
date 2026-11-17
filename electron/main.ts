import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import net from "net";
import { fork } from "child_process";
import fs from "fs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

delete process.env.ELECTRON_RUN_AS_NODE;

const { app, BrowserWindow, ipcMain } = require("electron");

const PORT = 3000;
const LOG_PATH = path.join(app.getPath("appData"), "DojoManager", "app-debug.log");

function writeLog(msg: string) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

let serverProcess: ReturnType<typeof fork> | null = null;
let mainWindow: any | null = null;

function waitForServer(port: number, retries = 30): Promise<void> {
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
    path.join(__dirname, "../../.output/server/index.mjs"),
    path.join(process.cwd(), ".output/server/index.mjs"),
    path.join(__dirname, "../.output/server/index.mjs"),
  ];
  const serverPath = possiblePaths.find(p => fs.existsSync(p));
  if (!serverPath) {
    writeLog(`Server not found in candidate paths: ${possiblePaths.join(", ")} — dev mode`);
    return;
  }
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(PORT) },
    stdio: "pipe",
  });
  serverProcess.stdout?.on("data", (d: Buffer) => writeLog(`[server] ${d.toString().trim()}`));
  serverProcess.stderr?.on("data", (d: Buffer) => writeLog(`[server:err] ${d.toString().trim()}`));
  writeLog("Server process forked");
}

async function createWindow() {
  const { screen } = require("electron");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const splash = new BrowserWindow({
    width: 400, height: 300, frame: false, alwaysOnTop: true, transparent: true,
    webPreferences: { nodeIntegration: false },
  });
  splash.loadURL("data:text/html,<body style='background:%238B1A1A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:white;flex-direction:column'><h1 style='font-size:2rem;font-weight:900'>🥋 DOJO MANAGER</h1><p>Starting up...</p></body>");

  mainWindow = new BrowserWindow({
    width, height, show: false,
    webPreferences: {
      preload: path.join(__dirname, "../electron/preload.cjs"),
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

  startServer();
  try {
    await waitForServer(PORT);
    writeLog("Server ready");
  } catch (e) {
    writeLog(`Server wait failed: ${e}`);
  }

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.maximize();
  mainWindow.once("ready-to-show", () => { splash.destroy(); mainWindow?.show(); });
  mainWindow.on("closed", () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => { serverProcess?.kill(); });
}
