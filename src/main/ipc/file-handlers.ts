import { ipcMain, dialog, shell } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import https from 'https';
import http from 'http';
import os from 'os';
import { getMainWindow } from '../window';

export function setupFileHandlers(): void {
  ipcMain.handle('open-file', async (_event, options: { filters?: Electron.FileFilter[] } = {}) => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('save-file', async (_event, options: { defaultPath?: string; filters?: Electron.FileFilter[] } = {}) => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: options.defaultPath,
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('select-folder', async (_event, options: { title?: string; defaultPath?: string } = {}) => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: options.title || 'Select a folder',
      properties: ['openDirectory'],
      defaultPath: options.defaultPath,
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('get-temp-directory', async () => os.tmpdir());

  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('show-item-in-folder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  ipcMain.handle('download-file', async (_event, url: string, filePath: string, progressId?: string) => {
    return new Promise((resolve, reject) => {
      const file = fsSync.createWriteStream(filePath);
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, (response) => {
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        response.pipe(file);

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && progressId) {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send(`download-progress-${progressId}`, downloadedBytes / totalBytes);
            }
          }
        });

        file.on('finish', () => {
          file.close();
          resolve({ success: true });
        });
      });

      request.on('error', (error) => {
        fsSync.unlink(filePath, () => {});
        reject(error);
      });
    });
  });

  ipcMain.handle('write-file', async (_event, filePath: string, data: ArrayBuffer) => {
    try {
      await fs.writeFile(filePath, Buffer.from(data));
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      const data = await fs.readFile(filePath);
      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    try {
      const files = await fs.readdir(dirPath);
      return { success: true, files };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  console.log('[FILE] IPC handlers registered');
}
