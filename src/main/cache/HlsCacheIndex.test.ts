import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { HlsCacheIndex } from './HlsCacheIndex';
import { IndexEntry } from './types';

describe('HlsCacheIndex', () => {
  let tmpDir: string;
  let indexPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hls-cache-test-'));
    indexPath = path.join(tmpDir, 'index.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const buildEntry = (overrides: Partial<IndexEntry> = {}): IndexEntry => ({
    hash: 'a'.repeat(64),
    originalUrl: 'https://example.blob.core.windows.net/segment_001.m4s',
    contentType: 'video/iso.segment',
    sizeBytes: 1024,
    lastAccessAt: Date.now(),
    ...overrides,
  });

  it('add then lookup returns the entry', () => {
    const idx = new HlsCacheIndex(indexPath);
    const entry = buildEntry();
    idx.add(entry);
    expect(idx.lookup(entry.originalUrl)?.hash).toBe(entry.hash);
  });

  it('touch updates lastAccessAt', () => {
    const idx = new HlsCacheIndex(indexPath);
    const entry = buildEntry({ lastAccessAt: 1000 });
    idx.add(entry);
    idx.touch(entry.hash, 5000);
    expect(idx.lookup(entry.originalUrl)?.lastAccessAt).toBe(5000);
  });

  it('totalSize sums all entries', () => {
    const idx = new HlsCacheIndex(indexPath);
    idx.add(buildEntry({ hash: 'a'.repeat(64), sizeBytes: 100 }));
    idx.add(
      buildEntry({
        hash: 'b'.repeat(64),
        originalUrl: 'https://example.blob.core.windows.net/segment_002.m4s',
        sizeBytes: 200,
      })
    );
    expect(idx.totalSize()).toBe(300);
  });

  it('selectEvictionCandidates returns oldest entries until target reached', () => {
    const idx = new HlsCacheIndex(indexPath);
    const now = Date.now();
    idx.add(
      buildEntry({
        hash: 'a'.repeat(64),
        originalUrl: 'u1',
        sizeBytes: 100,
        lastAccessAt: now - 60_000,
      })
    );
    idx.add(
      buildEntry({
        hash: 'b'.repeat(64),
        originalUrl: 'u2',
        sizeBytes: 100,
        lastAccessAt: now - 50_000,
      })
    );
    idx.add(
      buildEntry({
        hash: 'c'.repeat(64),
        originalUrl: 'u3',
        sizeBytes: 100,
        lastAccessAt: now - 40_000,
      })
    );

    const candidates = idx.selectEvictionCandidates(250, now);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0].hash).toBe('a'.repeat(64));
  });

  it('selectEvictionCandidates protects entries accessed within 30s', () => {
    const idx = new HlsCacheIndex(indexPath);
    const now = Date.now();
    idx.add(
      buildEntry({
        hash: 'a'.repeat(64),
        originalUrl: 'u1',
        sizeBytes: 100,
        lastAccessAt: now - 1_000,
      })
    );
    idx.add(
      buildEntry({
        hash: 'b'.repeat(64),
        originalUrl: 'u2',
        sizeBytes: 100,
        lastAccessAt: now - 2_000,
      })
    );

    const candidates = idx.selectEvictionCandidates(50, now);
    expect(candidates).toHaveLength(0);
  });

  it('persist writes JSON atomically (no .tmp left over)', async () => {
    const idx = new HlsCacheIndex(indexPath);
    idx.add(buildEntry());
    await idx.persist();

    const content = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.entries).toHaveLength(1);

    await expect(fs.access(indexPath + '.tmp')).rejects.toThrow();
  });

  it('load restores entries from JSON', async () => {
    const original = new HlsCacheIndex(indexPath);
    original.add(buildEntry());
    await original.persist();

    const restored = new HlsCacheIndex(indexPath);
    await restored.load();

    expect(
      restored.lookup('https://example.blob.core.windows.net/segment_001.m4s')
    ).toBeTruthy();
  });

  it('load with missing file leaves the index empty without throwing', async () => {
    const idx = new HlsCacheIndex(indexPath);
    await expect(idx.load()).resolves.not.toThrow();
    expect(idx.totalSize()).toBe(0);
  });

  it('load with corrupted JSON leaves the index empty', async () => {
    await fs.writeFile(indexPath, '{not valid json', 'utf8');
    const idx = new HlsCacheIndex(indexPath);
    await idx.load();
    expect(idx.totalSize()).toBe(0);
  });

  it('rebuildFromFilesystem uses mtime as lastAccessAt', async () => {
    const segmentsDir = tmpDir;
    const hash = 'd'.repeat(64);
    const filePath = path.join(segmentsDir, `${hash}.bin`);
    await fs.writeFile(filePath, Buffer.alloc(500));
    const stats = await fs.stat(filePath);

    const idx = new HlsCacheIndex(indexPath);
    await idx.rebuildFromFilesystem(segmentsDir);

    expect(idx.totalSize()).toBe(500);
    expect(idx.entriesCount()).toBe(1);
    const entry = Array.from(idx.allEntries())[0];
    expect(entry.lastAccessAt).toBeCloseTo(stats.mtimeMs, -1);
  });

  it('remove deletes the entry from the index', () => {
    const idx = new HlsCacheIndex(indexPath);
    const entry = buildEntry();
    idx.add(entry);
    idx.remove(entry.hash);
    expect(idx.lookup(entry.originalUrl)).toBeNull();
  });

  it('load filters out malformed entries (Olivier review)', async () => {
    const malformed = {
      version: 1,
      entries: [
        {
          // valid
          hash: 'a'.repeat(64),
          originalUrl: 'u1',
          contentType: 'video/iso.segment',
          sizeBytes: 100,
          lastAccessAt: 1000,
        },
        {
          // missing sizeBytes
          hash: 'b'.repeat(64),
          originalUrl: 'u2',
          contentType: 'video/iso.segment',
          lastAccessAt: 2000,
        },
        {
          // hash not 64 hex
          hash: 'short',
          originalUrl: 'u3',
          contentType: 'video/iso.segment',
          sizeBytes: 100,
          lastAccessAt: 3000,
        },
        {
          // sizeBytes not finite
          hash: 'c'.repeat(64),
          originalUrl: 'u4',
          contentType: 'video/iso.segment',
          sizeBytes: NaN,
          lastAccessAt: 4000,
        },
      ],
    };
    await fs.writeFile(indexPath, JSON.stringify(malformed), 'utf8');
    const idx = new HlsCacheIndex(indexPath);
    await idx.load();
    expect(idx.entriesCount()).toBe(1);
    expect(idx.totalSize()).toBe(100);
  });
});
