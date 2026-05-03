import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { HlsCacheManager } from './HlsCacheManager';

describe('HlsCacheManager', () => {
  let tmpDir: string;
  let manager: HlsCacheManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hls-mgr-test-'));
    manager = new HlsCacheManager(tmpDir);
    await manager.init();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const validUrl = 'https://example.blob.core.windows.net/segment_001.m4s';

  it('get on empty cache returns null', async () => {
    const result = await manager.get(validUrl);
    expect(result).toBeNull();
  });

  it('put then get returns the bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    await manager.put(validUrl, 'video/iso.segment', bytes);
    const result = await manager.get(validUrl);
    expect(result).not.toBeNull();
    expect(new Uint8Array(result!)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('put rejects URL outside whitelist', async () => {
    const bytes = new Uint8Array([1]).buffer;
    await expect(
      manager.put('https://evil.com/x.bin', 'video/iso.segment', bytes)
    ).rejects.toThrow(/domain not allowed/i);
  });

  it('put rejects payload over 50 MiB', async () => {
    const big = new Uint8Array(51 * 1024 * 1024).buffer;
    await expect(
      manager.put(validUrl, 'video/iso.segment', big)
    ).rejects.toThrow(/payload too large/i);
  });

  it('put no-ops when cache is disabled', async () => {
    await manager.setConfig({ enabled: false });
    const bytes = new Uint8Array([1]).buffer;
    await manager.put(validUrl, 'video/iso.segment', bytes);
    const stats = await manager.getStats();
    expect(stats.entries).toBe(0);
  });

  it('get returns null when cache is disabled even if entries exist', async () => {
    const bytes = new Uint8Array([1]).buffer;
    await manager.put(validUrl, 'video/iso.segment', bytes);
    await manager.setConfig({ enabled: false });
    const result = await manager.get(validUrl);
    expect(result).toBeNull();
  });

  it('eviction triggers when cap is exceeded', async () => {
    await manager.setConfig({ capBytes: 1000 });

    // Override Date.now() so that recent puts are not protected by the 30s window.
    const realNow = Date.now;
    let virtualTime = realNow();
    jest.spyOn(Date, 'now').mockImplementation(() => virtualTime);

    try {
      for (let i = 0; i < 10; i += 1) {
        const url = `https://example.blob.core.windows.net/seg_${i}.m4s`;
        const bytes = new Uint8Array(200).buffer;
        await manager.put(url, 'video/iso.segment', bytes);
        // Advance virtual time past the 30s eviction protection window.
        virtualTime += 60_000;
      }
      const stats = await manager.getStats();
      expect(stats.totalBytes).toBeLessThanOrEqual(1000);
    } finally {
      (Date.now as jest.Mock).mockRestore();
    }
  });

  it('purgeAll empties the cache', async () => {
    const bytes = new Uint8Array([1, 2]).buffer;
    await manager.put(validUrl, 'video/iso.segment', bytes);
    await manager.purgeAll();
    const stats = await manager.getStats();
    expect(stats.entries).toBe(0);
    expect(stats.totalBytes).toBe(0);
  });

  it('drainMetrics returns snapshot and resets', async () => {
    await manager.get(validUrl); // miss
    const bytes = new Uint8Array(100).buffer;
    await manager.put(validUrl, 'video/iso.segment', bytes);
    await manager.get(validUrl); // hit

    const snap = await manager.drainMetrics();
    expect(snap.hits).toBe(1);
    expect(snap.misses).toBeGreaterThanOrEqual(1);

    const snap2 = await manager.drainMetrics();
    expect(snap2.hits).toBe(0);
  });

  it('flushIndex persists the index to disk', async () => {
    const bytes = new Uint8Array([1, 2]).buffer;
    await manager.put(validUrl, 'video/iso.segment', bytes);
    await manager.flushIndex();
    const indexContent = await fs.readFile(
      path.join(tmpDir, 'index.json'),
      'utf8'
    );
    expect(indexContent).toContain('segment_001.m4s');
  });

  it('rejects non-https URLs even on whitelisted hosts', async () => {
    const bytes = new Uint8Array([1]).buffer;
    await expect(
      manager.put(
        'http://example.blob.core.windows.net/seg.m4s',
        'video/iso.segment',
        bytes
      )
    ).rejects.toThrow(/domain not allowed/i);
  });

  it('rejects URLs with non-default ports (Olivier review)', async () => {
    const bytes = new Uint8Array([1]).buffer;
    await expect(
      manager.put(
        'https://evil.kagron.app:8888/seg.m4s',
        'video/iso.segment',
        bytes
      )
    ).rejects.toThrow(/domain not allowed/i);
  });
});
