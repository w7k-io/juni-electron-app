import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock electron BEFORE importing the module under test.
const handlers: Record<string, (...args: unknown[]) => unknown> = {};
const beforeQuitListeners: Array<() => void> = [];

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    },
    removeHandler: (channel: string) => {
      delete handlers[channel];
    },
  },
  app: {
    getPath: jest.fn(),
    on: (event: string, listener: () => void) => {
      if (event === 'before-quit') beforeQuitListeners.push(listener);
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = jest.requireMock('electron') as {
  app: { getPath: jest.Mock };
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupCacheHandlers, _resetForTests } = require('./cache-handlers') as {
  setupCacheHandlers: () => Promise<unknown>;
  _resetForTests: () => void;
};

const invoke = async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
  const fn = handlers[channel];
  if (!fn) throw new Error(`no handler for channel ${channel}`);
  return (await fn({}, ...args)) as T;
};

describe('cache-handlers IPC', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-ipc-test-'));
    app.getPath.mockReturnValue(tmpDir);
    _resetForTests();
    beforeQuitListeners.length = 0;
    await setupCacheHandlers();
  });

  afterEach(async () => {
    _resetForTests();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('cache:get returns null when missing', async () => {
    const result = await invoke<ArrayBuffer | null>(
      'cache:get',
      'https://x.blob.core.windows.net/x.m4s'
    );
    expect(result).toBeNull();
  });

  it('cache:put then cache:get returns bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    await invoke(
      'cache:put',
      'https://x.blob.core.windows.net/x.m4s',
      'video/iso.segment',
      bytes
    );
    const got = await invoke<ArrayBuffer>(
      'cache:get',
      'https://x.blob.core.windows.net/x.m4s'
    );
    expect(got).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(got)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('cache:put rejects invalid arguments', async () => {
    await expect(
      invoke('cache:put', 123, 'video/iso.segment', new ArrayBuffer(1))
    ).rejects.toThrow();
  });

  it('cache:get-stats returns expected shape', async () => {
    const stats = await invoke<{
      totalBytes: number;
      entries: number;
      capBytes: number;
      enabled: boolean;
    }>('cache:get-stats');
    expect(stats).toMatchObject({
      totalBytes: expect.any(Number),
      entries: expect.any(Number),
      capBytes: expect.any(Number),
      enabled: expect.any(Boolean),
    });
  });

  it('cache:set-config rejects non-object payloads', async () => {
    await expect(invoke('cache:set-config', null)).rejects.toThrow();
    await expect(invoke('cache:set-config', 'not-an-object')).rejects.toThrow();
  });

  it('cache:set-config rejects out-of-preset capBytes', async () => {
    await expect(invoke('cache:set-config', { capBytes: 1234 })).rejects.toThrow(
      /invalid config/
    );
    await expect(invoke('cache:set-config', { capBytes: -1 })).rejects.toThrow();
    await expect(invoke('cache:set-config', { capBytes: '20' })).rejects.toThrow();
  });

  it('cache:set-config accepts preset capBytes values', async () => {
    await expect(
      invoke('cache:set-config', { capBytes: 50 * 1024 * 1024 * 1024 })
    ).resolves.toBeUndefined();
  });

  it('cache:set-config rejects non-boolean enabled', async () => {
    await expect(invoke('cache:set-config', { enabled: 'yes' })).rejects.toThrow();
    await expect(invoke('cache:set-config', { enabled: 1 })).rejects.toThrow();
  });

  it('cache:put rejects URLs with query string or fragment (defence in depth)', async () => {
    const bytes = new Uint8Array([1]).buffer;
    await expect(
      invoke(
        'cache:put',
        'https://x.blob.core.windows.net/seg.m4s?sas=secret',
        'video/iso.segment',
        bytes
      )
    ).rejects.toThrow(/canonicalUrl must not contain query string or fragment/);
    await expect(
      invoke(
        'cache:put',
        'https://x.blob.core.windows.net/seg.m4s#t=10',
        'video/iso.segment',
        bytes
      )
    ).rejects.toThrow(/canonicalUrl must not contain query string or fragment/);
  });

  it('cache:put rejects oversized contentType', async () => {
    const bytes = new Uint8Array([1]).buffer;
    const huge = 'a'.repeat(200);
    await expect(
      invoke('cache:put', 'https://x.blob.core.windows.net/seg.m4s', huge, bytes)
    ).rejects.toThrow(/invalid put arguments/);
  });

  it('cache:set-config disables cache and prevents subsequent puts', async () => {
    await invoke('cache:set-config', { enabled: false });
    const bytes = new Uint8Array([1]).buffer;
    await invoke(
      'cache:put',
      'https://x.blob.core.windows.net/y.m4s',
      'video/iso.segment',
      bytes
    );
    const stats = await invoke<{ entries: number }>('cache:get-stats');
    expect(stats.entries).toBe(0);
  });

  it('cache:drain-metrics returns a CacheMetricsSnapshot shape', async () => {
    const snap = await invoke<{ hits: number; windowEndAt: number }>(
      'cache:drain-metrics'
    );
    expect(snap).toMatchObject({
      hits: expect.any(Number),
      windowEndAt: expect.any(Number),
    });
  });

  it('cache:purge empties the cache', async () => {
    const bytes = new Uint8Array([7]).buffer;
    await invoke(
      'cache:put',
      'https://x.blob.core.windows.net/z.m4s',
      'video/iso.segment',
      bytes
    );
    await invoke('cache:purge');
    const stats = await invoke<{ entries: number; totalBytes: number }>(
      'cache:get-stats'
    );
    expect(stats.entries).toBe(0);
    expect(stats.totalBytes).toBe(0);
  });
});
