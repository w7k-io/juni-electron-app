import { ipcMain, app } from 'electron';
import path from 'path';
import { HlsCacheManager } from '../cache/HlsCacheManager';

let manager: HlsCacheManager | null = null;

export async function setupCacheHandlers(): Promise<HlsCacheManager> {
  const root = path.join(app.getPath('userData'), 'cache');
  manager = new HlsCacheManager(root);
  await manager.init();

  ipcMain.handle('cache:get', async (_event, canonicalUrl: string) => {
    if (typeof canonicalUrl !== 'string' || canonicalUrl.length === 0) {
      return null;
    }
    return manager!.get(canonicalUrl);
  });

  ipcMain.handle(
    'cache:put',
    async (
      _event,
      canonicalUrl: string,
      contentType: string,
      bytes: ArrayBuffer
    ) => {
      if (
        typeof canonicalUrl !== 'string' ||
        typeof contentType !== 'string' ||
        !(bytes instanceof ArrayBuffer)
      ) {
        throw new Error('invalid put arguments');
      }
      await manager!.put(canonicalUrl, contentType, bytes);
    }
  );

  ipcMain.handle('cache:get-stats', async () => manager!.getStats());
  ipcMain.handle('cache:get-config', async () => manager!.getConfig());
  ipcMain.handle(
    'cache:set-config',
    async (_event, cfg: { capBytes?: number; enabled?: boolean }) => {
      if (typeof cfg !== 'object' || cfg === null) {
        throw new Error('invalid config');
      }
      await manager!.setConfig(cfg);
    }
  );
  ipcMain.handle('cache:purge', async () => manager!.purgeAll());
  ipcMain.handle('cache:drain-metrics', async () => manager!.drainMetrics());

  app.on('before-quit', () => {
    if (manager) {
      void manager.flushIndex();
    }
  });

  console.log('[CACHE] IPC handlers registered');
  return manager;
}

// Test-only helpers.
export function _resetForTests(): void {
  manager = null;
  ipcMain.removeHandler('cache:get');
  ipcMain.removeHandler('cache:put');
  ipcMain.removeHandler('cache:get-stats');
  ipcMain.removeHandler('cache:get-config');
  ipcMain.removeHandler('cache:set-config');
  ipcMain.removeHandler('cache:purge');
  ipcMain.removeHandler('cache:drain-metrics');
}
