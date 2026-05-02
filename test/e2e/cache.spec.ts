/**
 * E2E test for the HLS cache bridge (JUNI-706).
 *
 * We don't replay a full HLS playback here (that requires login and a
 * real Azure SAS token, which the E2E env doesn't have). Instead we
 * exercise the IPC bridge directly from the renderer context, which is
 * exactly what the production custom hls.js Loader does.
 *
 * Scenarios:
 *  1. The cache bridge is exposed on window.electronAPI.cache
 *  2. put + get round-trip through IPC stores bytes on disk
 *  3. purge empties both the in-memory index and the on-disk segments
 *  4. Disabling the cache via setConfig prevents subsequent puts
 *  5. setConfig with an out-of-preset capBytes is rejected (Olivier guard)
 */
import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const BLOB_URL = 'https://kagrontest.blob.core.windows.net/p/seg.m4s';

interface CacheStats {
  totalBytes: number;
  entries: number;
  capBytes: number;
  enabled: boolean;
}

test.describe('JUNI-706 — HLS cache bridge', () => {
  let app: ElectronApplication;
  let win: Page;
  let userDataDir: string;

  test.beforeAll(async () => {
    const appBundle = path.resolve(process.cwd(), 'app-under-test', 'Kagron.app');
    const execPath = path.join(appBundle, 'Contents', 'MacOS', 'Kagron');

    app = await electron.launch({
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-gpu', '--password-store=basic'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        JUNI_TEST_MODE: 'true',
        ELECTRON_ENABLE_LOGGING: '1',
      },
      timeout: 120_000,
    });

    win = await app.firstWindow({ timeout: 30_000 });
    await win.waitForLoadState('domcontentloaded');

    // Resolve userData dir from main process.
    userDataDir = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('exposes a cache bridge on window.electronAPI', async () => {
    const present = await win.evaluate(() => {
      const api = (window as unknown as { electronAPI?: { cache?: unknown } }).electronAPI;
      return Boolean(api?.cache && typeof (api.cache as { get?: unknown }).get === 'function');
    });
    expect(present).toBe(true);
  });

  test('put + get round-trip writes and serves bytes', async () => {
    // Make sure cache is on for this test.
    await win.evaluate(async () => {
      await (window as unknown as {
        electronAPI: { cache: { setConfig: (c: { enabled: boolean }) => Promise<void> } };
      }).electronAPI.cache.setConfig({ enabled: true });
    });

    const roundTripped = await win.evaluate(async (canonical) => {
      const cache = (window as unknown as {
        electronAPI: {
          cache: {
            put: (u: string, ct: string, b: ArrayBuffer) => Promise<void>;
            get: (u: string) => Promise<ArrayBuffer | null>;
          };
        };
      }).electronAPI.cache;
      const bytes = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      await cache.put(canonical, 'video/iso.segment', bytes);
      const got = await cache.get(canonical);
      return got ? Array.from(new Uint8Array(got)) : null;
    }, BLOB_URL);

    expect(roundTripped).toEqual([1, 2, 3, 4, 5]);

    // The .bin file must exist on disk.
    const segmentsDir = path.join(userDataDir, 'cache', 'hls');
    const files = await fs.readdir(segmentsDir);
    expect(files.some((f) => f.endsWith('.bin'))).toBe(true);
  });

  test('purgeAll empties the cache (in-memory + filesystem)', async () => {
    await win.evaluate(async () => {
      await (window as unknown as {
        electronAPI: { cache: { purgeAll: () => Promise<void> } };
      }).electronAPI.cache.purgeAll();
    });

    const stats = (await win.evaluate(async () => {
      return (window as unknown as {
        electronAPI: { cache: { getStats: () => Promise<CacheStats> } };
      }).electronAPI.cache.getStats();
    })) as CacheStats;

    expect(stats.entries).toBe(0);
    expect(stats.totalBytes).toBe(0);

    const segmentsDir = path.join(userDataDir, 'cache', 'hls');
    const files = await fs.readdir(segmentsDir).catch(() => [] as string[]);
    expect(files.filter((f) => f.endsWith('.bin'))).toHaveLength(0);
  });

  test('setConfig({enabled:false}) prevents subsequent puts', async () => {
    await win.evaluate(async () => {
      const cache = (window as unknown as {
        electronAPI: {
          cache: {
            setConfig: (c: { enabled: boolean }) => Promise<void>;
            put: (u: string, ct: string, b: ArrayBuffer) => Promise<void>;
          };
        };
      }).electronAPI.cache;
      await cache.setConfig({ enabled: false });
      await cache.put(
        'https://kagrontest.blob.core.windows.net/p/disabled-test.m4s',
        'video/iso.segment',
        new Uint8Array([99]).buffer
      );
    });

    const stats = (await win.evaluate(async () => {
      return (window as unknown as {
        electronAPI: { cache: { getStats: () => Promise<CacheStats> } };
      }).electronAPI.cache.getStats();
    })) as CacheStats;

    expect(stats.entries).toBe(0);

    // Re-enable for subsequent tests / app shutdown flush.
    await win.evaluate(async () => {
      await (window as unknown as {
        electronAPI: { cache: { setConfig: (c: { enabled: boolean }) => Promise<void> } };
      }).electronAPI.cache.setConfig({ enabled: true });
    });
  });

  test('setConfig rejects out-of-preset capBytes (Olivier guard)', async () => {
    const errorMessage = await win.evaluate(async () => {
      try {
        await (window as unknown as {
          electronAPI: {
            cache: { setConfig: (c: { capBytes: number }) => Promise<void> };
          };
        }).electronAPI.cache.setConfig({ capBytes: 1234 });
        return null;
      } catch (err) {
        return (err as Error).message ?? String(err);
      }
    });
    expect(errorMessage).toMatch(/invalid config/i);
  });
});
