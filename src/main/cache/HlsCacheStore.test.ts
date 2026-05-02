import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { HlsCacheStore } from './HlsCacheStore';

describe('HlsCacheStore', () => {
  let tmpDir: string;
  let store: HlsCacheStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hls-store-test-'));
    store = new HlsCacheStore(tmpDir);
    await store.init();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const validHash = 'a'.repeat(64);

  it('init creates the segments directory', async () => {
    const stat = await fs.stat(path.join(tmpDir, 'hls'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('write then read returns the same bytes', async () => {
    const bytes = Buffer.from('hello world');
    await store.write(validHash, bytes);
    const read = await store.read(validHash);
    expect(read).not.toBeNull();
    expect(Buffer.from(read!).equals(bytes)).toBe(true);
  });

  it('write uses atomic rename (no .tmp left over)', async () => {
    await store.write(validHash, Buffer.from('data'));
    const files = await fs.readdir(path.join(tmpDir, 'hls'));
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('read returns null when file missing', async () => {
    const read = await store.read(validHash);
    expect(read).toBeNull();
  });

  it('delete removes the file', async () => {
    await store.write(validHash, Buffer.from('x'));
    await store.delete(validHash);
    const read = await store.read(validHash);
    expect(read).toBeNull();
  });

  it('delete non-existent file does not throw', async () => {
    await expect(store.delete('f'.repeat(64))).resolves.not.toThrow();
  });

  it('write throws on invalid hash', async () => {
    await expect(store.write('not-a-hash', Buffer.from('x'))).rejects.toThrow(
      /invalid hash/i
    );
    await expect(
      store.write('../etc/passwd', Buffer.from('x'))
    ).rejects.toThrow(/invalid hash/i);
  });

  it('read throws on invalid hash', async () => {
    await expect(store.read('not-a-hash')).rejects.toThrow(/invalid hash/i);
  });

  it('purgeAll removes all .bin files', async () => {
    await store.write(validHash, Buffer.from('a'));
    await store.write('b'.repeat(64), Buffer.from('b'));
    await store.purgeAll();
    const files = await fs.readdir(path.join(tmpDir, 'hls'));
    expect(files.filter((f) => f.endsWith('.bin'))).toHaveLength(0);
  });

  it('segmentsDir returns the right path', () => {
    expect(store.segmentsDir()).toBe(path.join(tmpDir, 'hls'));
  });

  it('indexPath returns the right path', () => {
    expect(store.indexPath()).toBe(path.join(tmpDir, 'index.json'));
  });
});
