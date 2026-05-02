import {
  CacheConfig,
  CacheStats,
  CacheMetricsSnapshot,
} from '../cache/types';

/**
 * IPC contract tests — verify that payloads exchanged with the renderer
 * (juni-app) survive a JSON round-trip without losing fields. If a
 * property is added on either side, this test breaks and forces the
 * mirror DTO to be updated.
 */
describe('IPC contract — cache:* payloads', () => {
  it('CacheConfig payload renderer → main', () => {
    const fromRenderer: CacheConfig = {
      capBytes: 20 * 1024 * 1024 * 1024,
      enabled: true,
    };
    const parsed = JSON.parse(JSON.stringify(fromRenderer)) as CacheConfig;
    expect(parsed.capBytes).toBe(fromRenderer.capBytes);
    expect(parsed.enabled).toBe(fromRenderer.enabled);
  });

  it('CacheStats payload main → renderer', () => {
    const fromMain: CacheStats = {
      totalBytes: 1024,
      entries: 4,
      capBytes: 20 * 1024 * 1024 * 1024,
      enabled: true,
    };
    const parsed = JSON.parse(JSON.stringify(fromMain)) as CacheStats;
    expect(parsed).toEqual(fromMain);
  });

  it('CacheMetricsSnapshot payload main → renderer is fully serializable', () => {
    const fromMain: CacheMetricsSnapshot = {
      hits: 12,
      misses: 3,
      hitBytes: 1234,
      missBytes: 567,
      evictions: 1,
      evictedBytes: 100,
      putErrors: 0,
      corruptionsDetected: 0,
      totalSizeBytes: 8192,
      entriesCount: 4,
      capBytes: 20 * 1024 * 1024 * 1024,
      enabled: true,
      windowStartAt: 1000,
      windowEndAt: 2000,
    };
    const parsed = JSON.parse(
      JSON.stringify(fromMain)
    ) as CacheMetricsSnapshot;
    expect(parsed).toEqual(fromMain);

    // Forward compat: an extra unknown field must be ignored silently.
    const withExtra = { ...fromMain, futureField: 'ignored' };
    const parsedWithExtra = JSON.parse(
      JSON.stringify(withExtra)
    ) as CacheMetricsSnapshot;
    expect(parsedWithExtra.hits).toBe(12);
  });
});
