import { BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createWindow(): BrowserWindow {
  const startUrl = process.env.KAGRON_FRONTEND_URL || process.env.JUNI_FRONTEND_URL || 'https://kagron.app';
  const isTestMode = process.env.JUNI_TEST_MODE === 'true';

  // Splash window: skip in test mode to avoid capturing the wrong window
  if (!isTestMode) {
    splashWindow = new BrowserWindow({
      width: 380,
      height: 480,
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
  }

  // Main window: hidden until webapp loads (or shown immediately in test mode)
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
          "default-src 'self' 'unsafe-inline' data: http://localhost:8080 https://kagron.app https://juni.w7k.app https://*.blob.core.windows.net https://juniproductionsa.blob.core.windows.net http://127.0.0.1:10000 https://unpkg.com; " +
          "connect-src 'self' http://localhost:8080 https://kagron.app https://juni.w7k.app https://*.blob.core.windows.net https://juniproductionsa.blob.core.windows.net http://127.0.0.1:10000 https://media.kagron.app; " +
          "style-src 'self' 'unsafe-inline' https://unpkg.com; " +
          "media-src 'self' http://localhost:8080 https://kagron.app https://juni.w7k.app https://*.blob.core.windows.net https://juniproductionsa.blob.core.windows.net http://127.0.0.1:10000 https://media.kagron.app blob:; " +
          "object-src 'none'"
        ],
      },
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Show main window and close splash (called once via IPC or fallback timeout)
  const splashShownAt = Date.now();
  const MIN_SPLASH_MS = 2_000;
  let appReady = false;

  const showMainWindow = () => {
    if (appReady) return;
    appReady = true;

    const elapsed = Date.now() - splashShownAt;
    const delay = Math.max(0, MIN_SPLASH_MS - elapsed);

    setTimeout(() => {
      console.log('[ELECTRON] App ready, switching from splash to main window');
      mainWindow?.show();

      if (process.env.JUNI_DEVTOOLS === 'true') {
        mainWindow?.webContents.openDevTools();
      }

      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, delay);
  };

  // Wait for the frontend to signal it has resolved auth state
  ipcMain.once('app:ready', () => {
    console.log('[ELECTRON] Received app:ready from frontend');
    showMainWindow();
  });

  // Fallback: show window after 90s even if signal never arrives (crash protection)
  setTimeout(() => {
    if (!appReady) {
      console.warn('[ELECTRON] Fallback timeout (90s) - showing main window without app:ready signal');
      showMainWindow();
    }
  }, 90_000);

  // Load the webapp URL in the hidden main window
  console.log('[ELECTRON] Loading webapp at', startUrl);
  mainWindow.loadURL(startUrl);

  return mainWindow;
}
