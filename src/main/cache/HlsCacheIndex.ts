import { promises as fs } from 'fs';
import path from 'path';
import {
  IndexEntry,
  EVICTION_HYSTERESIS,
  EVICTION_PROTECTION_MS,
} from './types';

interface IndexFileFormat {
  version: 1;
  entries: IndexEntry[];
}

const HASH_REGEX = /^[a-f0-9]{64}$/;

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidEntry(entry: unknown): entry is IndexEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Partial<IndexEntry>;
  if (typeof e.hash !== 'string' || !HASH_REGEX.test(e.hash)) return false;
  if (typeof e.originalUrl !== 'string') return false;
  if (typeof e.contentType !== 'string') return false;
  if (!isFiniteNonNegativeNumber(e.sizeBytes)) return false;
  if (!isFiniteNumber(e.lastAccessAt)) return false;
  return true;
}

export class HlsCacheIndex {
  private byUrl = new Map<string, IndexEntry>();
  private byHash = new Map<string, IndexEntry>();

  constructor(private readonly indexPath: string) {}

  add(entry: IndexEntry): void {
    this.byUrl.set(entry.originalUrl, entry);
    this.byHash.set(entry.hash, entry);
  }

  remove(hash: string): void {
    const entry = this.byHash.get(hash);
    if (!entry) return;
    this.byHash.delete(hash);
    this.byUrl.delete(entry.originalUrl);
  }

  lookup(originalUrl: string): IndexEntry | null {
    return this.byUrl.get(originalUrl) ?? null;
  }

  lookupByHash(hash: string): IndexEntry | null {
    return this.byHash.get(hash) ?? null;
  }

  touch(hash: string, now: number): void {
    const entry = this.byHash.get(hash);
    if (entry) {
      entry.lastAccessAt = now;
    }
  }

  totalSize(): number {
    let sum = 0;
    for (const entry of this.byHash.values()) sum += entry.sizeBytes;
    return sum;
  }

  entriesCount(): number {
    return this.byHash.size;
  }

  allEntries(): IterableIterator<IndexEntry> {
    return this.byHash.values();
  }

  selectEvictionCandidates(capBytes: number, now: number): IndexEntry[] {
    const total = this.totalSize();
    if (total <= capBytes) return [];

    const target = Math.floor(capBytes * EVICTION_HYSTERESIS);
    const protectedThreshold = now - EVICTION_PROTECTION_MS;

    const sorted = Array.from(this.byHash.values())
      .filter((e) => e.lastAccessAt < protectedThreshold)
      .sort((a, b) => a.lastAccessAt - b.lastAccessAt);

    const candidates: IndexEntry[] = [];
    let freed = 0;
    const need = total - target;

    for (const entry of sorted) {
      if (freed >= need) break;
      candidates.push(entry);
      freed += entry.sizeBytes;
    }

    return candidates;
  }

  async persist(): Promise<void> {
    const data: IndexFileFormat = {
      version: 1,
      entries: Array.from(this.byHash.values()),
    };
    const tmp = this.indexPath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
    await fs.rename(tmp, this.indexPath);
  }

  async load(): Promise<void> {
    this.byUrl.clear();
    this.byHash.clear();
    try {
      const raw = await fs.readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as IndexFileFormat;
      if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return;
      for (const entry of parsed.entries) {
        if (!isValidEntry(entry)) continue;
        this.byUrl.set(entry.originalUrl, entry);
        this.byHash.set(entry.hash, entry);
      }
    } catch {
      // Missing or corrupted: silent fallback to empty index.
    }
  }

  async rebuildFromFilesystem(segmentsDir: string): Promise<void> {
    this.byUrl.clear();
    this.byHash.clear();
    let files: string[];
    try {
      files = await fs.readdir(segmentsDir);
    } catch {
      return;
    }
    for (const file of files) {
      const baseName = path.basename(file);
      if (!baseName.endsWith('.bin')) continue;
      const hash = baseName.slice(0, -4);
      if (!HASH_REGEX.test(hash)) continue;
      // SECURITY: rebuild path from the validated hash, not the raw readdir
      // entry, so static analysis can verify there's no traversal sequence.
      const safeName = `${hash}.bin`;
      // codacy:ignore — `safeName` is built from `hash` already validated
      // against /^[a-f0-9]{64}$/ on the line just above.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const stats = await fs.stat(path.join(segmentsDir, safeName));
      const entry: IndexEntry = {
        hash,
        originalUrl: `<rebuilt:${hash}>`,
        contentType: 'application/octet-stream',
        sizeBytes: stats.size,
        lastAccessAt: stats.mtimeMs,
      };
      this.byHash.set(hash, entry);
      // No byUrl mapping — original URL was lost with the index.
    }
  }
}
