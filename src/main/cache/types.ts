export interface CacheConfig {
  capBytes: number;
  enabled: boolean;
}

export interface CacheStats {
  totalBytes: number;
  entries: number;
  capBytes: number;
  enabled: boolean;
}

export interface IndexEntry {
  hash: string;
  originalUrl: string;
  contentType: string;
  sizeBytes: number;
  lastAccessAt: number;
}

export interface CacheMetricsSnapshot {
  hits: number;
  misses: number;
  hitBytes: number;
  missBytes: number;
  evictions: number;
  evictedBytes: number;
  putErrors: number;
  corruptionsDetected: number;
  totalSizeBytes: number;
  entriesCount: number;
  capBytes: number;
  enabled: boolean;
  windowStartAt: number;
  windowEndAt: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  capBytes: 20 * 1024 * 1024 * 1024,
  enabled: true,
};

export const CAP_PRESETS_BYTES = [
  10 * 1024 * 1024 * 1024,
  20 * 1024 * 1024 * 1024,
  50 * 1024 * 1024 * 1024,
  100 * 1024 * 1024 * 1024,
] as const;

export const MAX_PUT_BYTES = 50 * 1024 * 1024;
export const EVICTION_HYSTERESIS = 0.9;
export const EVICTION_PROTECTION_MS = 30_000;

export const ALLOWED_DOMAINS: ReadonlyArray<RegExp> = [
  /\.blob\.core\.windows\.net$/i,
  /\.kagron\.app$/i,
  /\.w7k\.app$/i,
];
