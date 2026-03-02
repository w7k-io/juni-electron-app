import { app, BrowserWindow } from 'electron';
import { createWindow } from './window';
import { setupKeychainHandlers } from './ipc/keychain-handlers';
import { setupFileHandlers } from './ipc/file-handlers';
import { setupMiscHandlers } from './ipc/misc-handlers';
import { setupAutoUpdater } from './updater';

// Handle Squirrel events (Windows install/update/uninstall)
// On macOS with Squirrel, the app just launches normally

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged && !process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // Register IPC handlers
  setupKeychainHandlers();
  setupFileHandlers();
  setupMiscHandlers();

  // Start auto-updater
  setupAutoUpdater();

  console.log('[ELECTRON] Juni ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: prevent navigation to external sites
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (navigationEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://juni.w7k.app',
    ];
    if (!allowedOrigins.includes(parsedUrl.origin)) {
      navigationEvent.preventDefault();
    }
  });
});

console.log('[ELECTRON] Main process started - Juni Handball Analysis');
