import { HlsCacheMetrics } from './HlsCacheMetrics';

describe('HlsCacheMetrics', () => {
  let metrics: HlsCacheMetrics;

  beforeEach(() => {
    metrics = new HlsCacheMetrics();
  });

  const baseGauges = {
    totalSizeBytes: 0,
    entriesCount: 0,
    capBytes: 1000,
    enabled: true,
  };

  it('starts with empty counters', () => {
    const snap = metrics.drain(baseGauges);
    expect(snap.hits).toBe(0);
    expect(snap.misses).toBe(0);
    expect(snap.hitBytes).toBe(0);
    expect(snap.evictions).toBe(0);
  });

  it('hit increments hits and hitBytes', () => {
    metrics.hit(1024);
    metrics.hit(2048);
    const snap = metrics.drain(baseGauges);
    expect(snap.hits).toBe(2);
    expect(snap.hitBytes).toBe(3072);
  });

  it('miss increments misses and missBytes', () => {
    metrics.miss(500);
    const snap = metrics.drain(baseGauges);
    expect(snap.misses).toBe(1);
    expect(snap.missBytes).toBe(500);
  });

  it('evict accumulates evictions and evictedBytes', () => {
    metrics.evict(3, 4096);
    const snap = metrics.drain(baseGauges);
    expect(snap.evictions).toBe(3);
    expect(snap.evictedBytes).toBe(4096);
  });

  it('drain resets counters and updates window timestamps', () => {
    metrics.hit(100);
    const t0 = Date.now();
    const snap1 = metrics.drain(baseGauges);
    expect(snap1.hits).toBe(1);
    expect(snap1.windowEndAt).toBeGreaterThanOrEqual(t0);

    const snap2 = metrics.drain(baseGauges);
    expect(snap2.hits).toBe(0);
    expect(snap2.windowStartAt).toBeGreaterThanOrEqual(snap1.windowEndAt);
  });

  it('putError and corruptionDetected increment counters', () => {
    metrics.putError();
    metrics.corruptionDetected();
    const snap = metrics.drain(baseGauges);
    expect(snap.putErrors).toBe(1);
    expect(snap.corruptionsDetected).toBe(1);
  });

  it('drain reports current gauges', () => {
    const snap = metrics.drain({
      totalSizeBytes: 8192,
      entriesCount: 4,
      capBytes: 16384,
      enabled: false,
    });
    expect(snap.totalSizeBytes).toBe(8192);
    expect(snap.entriesCount).toBe(4);
    expect(snap.capBytes).toBe(16384);
    expect(snap.enabled).toBe(false);
  });
});
