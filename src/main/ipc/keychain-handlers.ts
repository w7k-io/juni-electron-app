import { ipcMain, safeStorage, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const getCredentialsPath = (): string =>
  path.join(app.getPath('userData'), 'credentials.json');

const readCredentials = async (): Promise<Record<string, string>> => {
  try {
    const data = await fs.readFile(getCredentialsPath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
};

const writeCredentials = async (credentials: Record<string, string>): Promise<void> => {
  await fs.writeFile(getCredentialsPath(), JSON.stringify(credentials, null, 2));
};

export function setupKeychainHandlers(): void {
  ipcMain.handle('keychain-set-password', async (_event, account: string, password: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption not available' };
      }
      const encrypted = safeStorage.encryptString(password);
      const credentials = await readCredentials();
      credentials[account] = encrypted.toString('base64');
      await writeCredentials(credentials);
      console.log(`[KEYCHAIN] Password saved for ${account}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[KEYCHAIN] Save error:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('keychain-get-password', async (_event, account: string) => {
    try {
      const credentials = await readCredentials();
      const encryptedBase64 = credentials[account];
      if (encryptedBase64) {
        const encrypted = Buffer.from(encryptedBase64, 'base64');
        const password = safeStorage.decryptString(encrypted);
        return { success: true, password };
      }
      return { success: false, error: 'No password found' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[KEYCHAIN] Get error:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('keychain-delete-password', async (_event, account: string) => {
    try {
      const credentials = await readCredentials();
      if (credentials[account]) {
        delete credentials[account];
        await writeCredentials(credentials);
        console.log(`[KEYCHAIN] Password deleted for ${account}`);
        return { success: true };
      }
      return { success: false, error: 'No password to delete' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[KEYCHAIN] Delete error:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('keychain-find-credentials', async (_event, account: string) => {
    try {
      const credentials = await readCredentials();
      return { success: true, exists: !!credentials[account] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[KEYCHAIN] Find error:', message);
      return { success: false, error: message };
    }
  });

  console.log('[KEYCHAIN] IPC handlers registered');
}
