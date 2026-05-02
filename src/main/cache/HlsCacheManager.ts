import { createHash } from 'crypto';
import { HlsCacheIndex } from './HlsCacheIndex';
import { HlsCacheStore } from './HlsCacheStore';
import { HlsCacheMetrics } from './HlsCacheMetrics';
import {
  ALLOWED_DOMAINS,
  CacheConfig,
  CacheStats,
  CacheMetricsSnapshot,
  DEFAULT_CACHE_CONFIG,
  IndexEntry,
  MAX_PUT_BYTES,
} from './types';

export class HlsCacheManager {
  private readonly store: HlsCacheStore;
  private readonly index: HlsCacheIndex;
  private readonly metrics = new HlsCacheMetrics();
  private config: CacheConfig = { ...DEFAULT_CACHE_CONFIG };

  constructor(rootDir: string) {
    this.store = new HlsCacheStore(rootDir);
    this.index = new HlsCacheIndex(this.store.indexPath());
  }

  async init(): Promise<void> {
    await this.store.init();
    await this.index.load();
    if (this.index.entriesCount() === 0) {
      await this.index.rebuildFromFilesystem(this.store.segmentsDir());
    }
  }

  async get(canonicalUrl: string): Promise<ArrayBuffer | null> {
    if (!this.config.enabled) return null;
    const entry = this.index.lookup(canonicalUrl);
    if (!entry) {
      this.metrics.miss(0);
      return null;
    }
    const bytes = await this.store.read(entry.hash);
    if (!bytes) {
      this.index.remove(entry.hash);
      this.metrics.corruptionDetected();
      this.metrics.miss(0);
      return null;
    }
    this.index.touch(entry.hash, Date.now());
    this.metrics.hit(entry.sizeBytes);
    return toArrayBuffer(bytes);
  }

  async put(
    canonicalUrl: string,
    contentType: string,
    bytes: ArrayBuffer
  ): Promise<void> {
    if (!this.config.enabled) return;
    if (!this.isUrlAllowed(canonicalUrl)) {
      throw new Error(`domain not allowed: ${canonicalUrl}`);
    }
    if (bytes.byteLength > MAX_PUT_BYTES) {
      throw new Error(`payload too large: ${bytes.byteLength}`);
    }
    const hash = sha256Hex(canonicalUrl);
    try {
      await this.store.write(hash, Buffer.from(bytes));
    } catch {
      this.metrics.putError();
      // ENOSPC, EACCES → silent no-op (segment was already fetched).
      return;
    }
    const entry: IndexEntry = {
      hash,
      originalUrl: canonicalUrl,
      contentType,
      sizeBytes: bytes.byteLength,
      lastAccessAt: Date.now(),
    };
    this.index.add(entry);
    await this.evictIfOverCap();
  }

  async getStats(): Promise<CacheStats> {
    return {
      totalBytes: this.index.totalSize(),
      entries: this.index.entriesCount(),
      capBytes: this.config.capBytes,
      enabled: this.config.enabled,
    };
  }

  async getConfig(): Promise<CacheConfig> {
    return { ...this.config };
  }

  async setConfig(cfg: Partial<CacheConfig>): Promise<void> {
    this.config = { ...this.config, ...cfg };
    if (cfg.capBytes !== undefined) {
      await this.evictIfOverCap();
    }
  }

  async purgeAll(): Promise<void> {
    await this.store.purgeAll();
    for (const entry of Array.from(this.index.allEntries())) {
      this.index.remove(entry.hash);
    }
  }

  async drainMetrics(): Promise<CacheMetricsSnapshot> {
    return this.metrics.drain({
      totalSizeBytes: this.index.totalSize(),
      entriesCount: this.index.entriesCount(),
      capBytes: this.config.capBytes,
      enabled: this.config.enabled,
    });
  }

  async flushIndex(): Promise<void> {
    await this.index.persist();
  }

  private async evictIfOverCap(): Promise<void> {
    const candidates = this.index.selectEvictionCandidates(
      this.config.capBytes,
      Date.now()
    );
    if (candidates.length === 0) return;
    let evictedBytes = 0;
    for (const entry of candidates) {
      await this.store.delete(entry.hash);
      this.index.remove(entry.hash);
      evictedBytes += entry.sizeBytes;
    }
    this.metrics.evict(candidates.length, evictedBytes);
  }

  private isUrlAllowed(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false;
      // Reject non-standard ports — Azure Blob and kagron.app live on 443.
      // Empty u.port means default 443.
      if (u.port !== '') return false;
      return ALLOWED_DOMAINS.some((re) => re.test(u.hostname));
    } catch {
      return false;
    }
  }
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const view = new Uint8Array(buf.byteLength);
  view.set(buf);
  return view.buffer;
}
