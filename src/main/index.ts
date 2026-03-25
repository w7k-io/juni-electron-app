import { app, BrowserWindow, session, dialog } from 'electron';
import { createWindow, getMainWindow } from './window';
import { setupKeychainHandlers } from './ipc/keychain-handlers';
import { setupFileHandlers } from './ipc/file-handlers';
import { setupMiscHandlers } from './ipc/misc-handlers';
import { setupAutoUpdater } from './updater';
import path from 'path';

// Store the save path chosen by the user (set before downloadURL triggers will-download)
let pendingSavePath: string | null = null;

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

  // Handle file downloads: apply the pre-chosen save path
  session.defaultSession.on('will-download', (_event, item) => {
    if (pendingSavePath) {
      item.setSavePath(pendingSavePath);
      pendingSavePath = null;
    }

    item.on('done', (_e, state) => {
      if (state === 'completed') {
        console.log('[DOWNLOAD] Completed:', item.getSavePath());
      } else {
        console.log('[DOWNLOAD] Failed:', state);
      }
    });
  });

  console.log('[ELECTRON] Kagron ready');
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
      'https://kagron.app',
      'https://juni.w7k.app',
    ];
    if (!allowedOrigins.includes(parsedUrl.origin)) {
      navigationEvent.preventDefault();
    }
  });

  // Prevent new windows from opening (e.g. <a target="_blank">)
  // Instead, trigger a download for file URLs or deny the window
  contents.setWindowOpenHandler(({ url }) => {
    // Allow blob: URLs to be handled as downloads
    if (url.startsWith('blob:')) {
      return { action: 'deny' };
    }

    // For Azure Blob Storage / video service URLs, trigger a download
    const downloadPatterns = [
      '.blob.core.windows.net',
      'media.kagron.app',
      '/api/sequences/',
      '.mp4',
      '.zip',
    ];

    const isDownloadUrl = downloadPatterns.some(pattern => url.includes(pattern));
    if (isDownloadUrl) {
      const win = getMainWindow();
      if (win) {
        // Extract filename from URL
        const urlPath = new URL(url).pathname;
        const fileName = path.basename(urlPath) || 'download.mp4';
        const ext = path.extname(fileName).slice(1) || 'mp4';
        const filters = ext === 'zip'
          ? [{ name: 'Archive ZIP', extensions: ['zip'] }]
          : [{ name: 'Video MP4', extensions: ['mp4'] }];

        // Show save dialog BEFORE starting the download
        dialog.showSaveDialog(win, {
          defaultPath: fileName,
          filters,
        }).then(({ canceled, filePath }) => {
          if (!canceled && filePath) {
            pendingSavePath = filePath;
            win.webContents.downloadURL(url);
          }
        });
      }
      return { action: 'deny' };
    }

    // Deny all other new windows
    return { action: 'deny' };
  });
});

console.log('[ELECTRON] Main process started - Kagron Handball Analysis');
