const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
});
