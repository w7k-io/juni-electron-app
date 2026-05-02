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
        .filter((f) => f.endsWith('.bin'))
        .map((f) => fs.unlink(path.join(dir, f)).catch(() => undefined))
    );
  }

  private filePath(hash: string): string {
    return path.join(this.segmentsDir(), `${hash}.bin`);
  }

  private assertValidHash(hash: string): void {
    if (!HASH_REGEX.test(hash)) {
      throw new Error(`invalid hash: ${hash}`);
    }
  }
}
