import { ipcMain, shell } from 'electron';

export function setupMiscHandlers(): void {
  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('open-email-client', async (_event, email: string) => {
    try {
      const subject = encodeURIComponent('Kagron - Réinitialisation mot de passe');
      const body = encodeURIComponent(
        `Bonjour,\n\nJe souhaite réinitialiser mon mot de passe pour l'application Kagron.\n\nMon email: ${email}\n\nMerci de m'envoyer le lien de réinitialisation.\n\nCordialement`
      );
      await shell.openExternal(`mailto:support@juni.app?subject=${subject}&body=${body}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[EMAIL] Error:', message);
      return { success: false, error: message };
    }
  });

  console.log('[MISC] IPC handlers registered');
}
