import { ipcMain, app } from 'electron';
import path from 'path';
import { HlsCacheManager } from '../cache/HlsCacheManager';
import { CAP_PRESETS_BYTES } from '../cache/types';

const MAX_CONTENT_TYPE_LENGTH = 128;

function isValidConfig(cfg: unknown): cfg is { capBytes?: number; enabled?: boolean } {
  if (typeof cfg !== 'object' || cfg === null) return false;
  const c = cfg as { capBytes?: unknown; enabled?: unknown };
  if (c.capBytes !== undefined) {
    if (typeof c.capBytes !== 'number' || !Number.isFinite(c.capBytes)) return false;
    if (!CAP_PRESETS_BYTES.includes(c.capBytes as (typeof CAP_PRESETS_BYTES)[number])) return false;
  }
  if (c.enabled !== undefined && typeof c.enabled !== 'boolean') return false;
  return true;
}

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
        contentType.length > MAX_CONTENT_TYPE_LENGTH ||
        !(bytes instanceof ArrayBuffer)
      ) {
        throw new Error('invalid put arguments');
      }
      // Defence in depth: a properly canonicalized URL has no query
      // string and no fragment. If the renderer forgets to canonicalize
      // (e.g. forwarding a URL with a SAS token), fail loud — better than
      // silently leaking the SAS into the index/logs.
      if (canonicalUrl.includes('?') || canonicalUrl.includes('#')) {
        throw new Error('canonicalUrl must not contain query string or fragment');
      }
      await manager!.put(canonicalUrl, contentType, bytes);
    }
  );

  ipcMain.handle('cache:get-stats', async () => manager!.getStats());
  ipcMain.handle('cache:get-config', async () => manager!.getConfig());
  ipcMain.handle(
    'cache:set-config',
    async (_event, cfg: { capBytes?: number; enabled?: boolean }) => {
      if (!isValidConfig(cfg)) {
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
