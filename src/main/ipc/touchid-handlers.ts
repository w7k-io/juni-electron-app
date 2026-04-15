import { ipcMain, systemPreferences } from 'electron';

/**
 * JUNI-720 — Touch ID IPC handlers.
 *
 * Wraps Electron's macOS-only `systemPreferences.promptTouchID` so the
 * renderer can offer a "Login with Touch ID" button that unlocks credentials
 * stored locally via safeStorage (see keychain-handlers.ts). No backend
 * round-trip is involved — biometric verification is purely local.
 */
export function setupTouchIdHandlers(): void {
  ipcMain.handle('touchid:available', (): boolean => {
    if (process.platform !== 'darwin') return false;
    try {
      return systemPreferences.canPromptTouchID();
    } catch {
      return false;
    }
  });

  ipcMain.handle('touchid:prompt', async (_event, reason: string): Promise<boolean> => {
    if (process.platform !== 'darwin') return false;
    try {
      await systemPreferences.promptTouchID(reason);
      return true;
    } catch {
      return false;
    }
  });

  console.log('[TOUCHID] IPC handlers registered');
}
