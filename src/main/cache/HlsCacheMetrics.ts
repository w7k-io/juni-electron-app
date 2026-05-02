import { CacheMetricsSnapshot } from './types';

interface CurrentGauges {
  totalSizeBytes: number;
  entriesCount: number;
  capBytes: number;
  enabled: boolean;
}

export class HlsCacheMetrics {
  private hits = 0;
  private misses = 0;
  private hitBytes = 0;
  private missBytes = 0;
  private evictions = 0;
  private evictedBytes = 0;
  private putErrors = 0;
  private corruptionsDetected = 0;
  private windowStartAt = Date.now();

  hit(bytes: number): void {
    this.hits += 1;
    this.hitBytes += bytes;
  }

  miss(bytes: number): void {
    this.misses += 1;
    this.missBytes += bytes;
  }

  evict(count: number, bytes: number): void {
    this.evictions += count;
    this.evictedBytes += bytes;
  }

  putError(): void {
    this.putErrors += 1;
  }

  corruptionDetected(): void {
    this.corruptionsDetected += 1;
  }

  drain(gauges: CurrentGauges): CacheMetricsSnapshot {
    const now = Date.now();
    const snapshot: CacheMetricsSnapshot = {
      hits: this.hits,
      misses: this.misses,
      hitBytes: this.hitBytes,
      missBytes: this.missBytes,
      evictions: this.evictions,
      evictedBytes: this.evictedBytes,
      putErrors: this.putErrors,
      corruptionsDetected: this.corruptionsDetected,
      totalSizeBytes: gauges.totalSizeBytes,
      entriesCount: gauges.entriesCount,
      capBytes: gauges.capBytes,
      enabled: gauges.enabled,
      windowStartAt: this.windowStartAt,
      windowEndAt: now,
    };
    this.reset(now);
    return snapshot;
  }

  private reset(now: number): void {
    this.hits = 0;
    this.misses = 0;
    this.hitBytes = 0;
    this.missBytes = 0;
    this.evictions = 0;
    this.evictedBytes = 0;
    this.putErrors = 0;
    this.corruptionsDetected = 0;
    this.windowStartAt = now;
  }
}
