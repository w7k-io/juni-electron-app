import { ipcMain, shell } from 'electron';

export function setupMiscHandlers(): void {
  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  console.log('[MISC] IPC handlers registered');
}
