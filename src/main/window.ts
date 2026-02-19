import { BrowserWindow, session } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createWindow(): BrowserWindow {
  const startUrl = process.env.JUNI_FRONTEND_URL || 'https://juni.w7k.app';

  // Splash window: visible immediately, frameless
  splashWindow = new BrowserWindow({
    width: 500,
    height: 700,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#0f0f23',
    center: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
  });

  splashWindow.loadFile(path.join(__dirname, '..', 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow?.show());

  // Main window: hidden, loads the webapp
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Kagron',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
    icon: path.join(__dirname, '..', '..', 'build', 'icon.icns'),
    titleBarStyle: 'default',
    backgroundColor: '#0f0f23',
    show: false,
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // When webapp is fully loaded, show main window and close splash
  // Minimum splash display time to avoid a jarring flash
  const splashShownAt = Date.now();
  const MIN_SPLASH_MS = 2_000;

  mainWindow.webContents.on('did-finish-load', () => {
    const elapsed = Date.now() - splashShownAt;
    const delay = Math.max(0, MIN_SPLASH_MS - elapsed);

    setTimeout(() => {
      console.log('[ELECTRON] Webapp loaded, switching from splash to main window');
      mainWindow?.show();

      if (process.env.JUNI_DEVTOOLS === 'true') {
        mainWindow?.webContents.openDevTools();
      }

      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, delay);
  });

  // Load the webapp URL in the hidden main window
  console.log('[ELECTRON] Loading webapp at', startUrl);
  mainWindow.loadURL(startUrl);

  return mainWindow;
}
