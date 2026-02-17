import { BrowserWindow, session } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Juni',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
    icon: path.join(__dirname, '..', '..', 'build', 'icon.icns'),
    titleBarStyle: 'default',
    show: true,
  });

  const startUrl = process.env.JUNI_FRONTEND_URL || 'https://juni.w7k.app';
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    if (process.env.JUNI_DEVTOOLS === 'true') {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // CSP headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: http://localhost:8080 https://juni.w7k.app https://*.blob.core.windows.net https://juniproductionsa.blob.core.windows.net http://127.0.0.1:10000 https://unpkg.com; " +
          "connect-src 'self' http://localhost:8080 https://juni.w7k.app https://*.blob.core.windows.net https://juniproductionsa.blob.core.windows.net http://127.0.0.1:10000; " +
          "style-src 'self' 'unsafe-inline' https://unpkg.com; " +
          "media-src 'self' http://localhost:8080 https://juni.w7k.app https://*.blob.core.windows.net https://juniproductionsa.blob.core.windows.net http://127.0.0.1:10000 blob:; " +
          "object-src 'none'"
        ],
      },
    });
  });

  return mainWindow;
}
