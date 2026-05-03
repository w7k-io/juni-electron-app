import { promises as fs } from 'fs';
import path from 'path';

const HASH_REGEX = /^[a-f0-9]{64}$/;

export class HlsCacheStore {
  constructor(private readonly rootDir: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.segmentsDir(), { recursive: true });
  }

  segmentsDir(): string {
    return path.join(this.rootDir, 'hls');
  }

  indexPath(): string {
    return path.join(this.rootDir, 'index.json');
  }

  async write(hash: string, bytes: Buffer | Uint8Array): Promise<void> {
    this.assertValidHash(hash);
    const filePath = this.filePath(hash);
    const tmp = filePath + '.tmp';
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, filePath);
  }

  async read(hash: string): Promise<Buffer | null> {
    this.assertValidHash(hash);
    try {
      return await fs.readFile(this.filePath(hash));
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(hash: string): Promise<void> {
    this.assertValidHash(hash);
    try {
      await fs.unlink(this.filePath(hash));
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
  }

  async purgeAll(): Promise<void> {
    const dir = this.segmentsDir();
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      return;
    }
    await Promise.all(
      files
        .filter(isBinFileName)
        // Use basename to make the path-traversal-safety obvious to static
        // analysis: fs.readdir returns leaf names, but we re-strip just in case.
        .map((f) => fs.unlink(path.join(dir, path.basename(f))).catch(() => undefined))
    );
  }

  /**
   * Build the absolute path of a cache entry.
   *
   * SECURITY: `hash` MUST already have been validated by `assertValidHash()`
   * (regex /^[a-f0-9]{64}$/). The wrapping `path.basename()` is a belt-and-
   * braces safeguard so static analyzers can see that no traversal sequence
   * (`..`, `/`) can survive even if the regex were ever loosened.
   */
  private filePath(hash: string): string {
    const safeName = path.basename(`${hash}.bin`);
    return path.join(this.segmentsDir(), safeName);
  }

  private assertValidHash(hash: string): void {
    if (!HASH_REGEX.test(hash)) {
      throw new Error(`invalid hash: ${hash}`);
    }
  }
}

function isBinFileName(name: string): boolean {
  // Only accept bare leaf .bin files written by HlsCacheStore (no traversal).
  return /^[a-f0-9]{64}\.bin$/.test(name);
}
