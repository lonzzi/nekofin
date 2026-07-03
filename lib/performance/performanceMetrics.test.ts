import { describe, expect, it } from 'vitest';

import {
  createRingBuffer,
  formatRouteTarget,
  sanitizeNetworkUrl,
  summarizePerformanceSamples,
  type PerformanceSample,
} from './performanceMetrics';

function makeSample(patch: Partial<PerformanceSample>): PerformanceSample {
  return {
    activeTraceCount: 0,
    eventLoopLagMs: 0,
    id: 0,
    jsFps: 60,
    maxFrameMs: 16,
    nativeMetricsAvailable: true,
    networkPendingCount: 0,
    queryFetchingCount: 0,
    queryStaleCount: 0,
    queryTotalCount: 0,
    rafJsFps: 60,
    timestamp: 1,
    ...patch,
  };
}

describe('performance metrics', () => {
  it('keeps only the latest values in a ring buffer', () => {
    const buffer = createRingBuffer<number>(3);

    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);

    expect(buffer.toArray()).toEqual([2, 3, 4]);
    expect(buffer.size()).toBe(3);
  });

  it('sanitizes network URLs without query strings', () => {
    expect(sanitizeNetworkUrl('https://example.test/items?id=1&token=secret')).toBe(
      'https://example.test/items',
    );
    expect(sanitizeNetworkUrl('/path?token=secret')).toBe('/path');
  });

  it('formats route targets with sorted param keys', () => {
    expect(
      formatRouteTarget({
        pathname: '/movie/[id]',
        params: { serverId: 'server-1', id: 'movie-1' },
      }),
    ).toBe('/movie/[id]?id,serverId');
  });

  it('summarizes native and JS samples', () => {
    const summary = summarizePerformanceSamples([
      makeSample({
        cpuUsage: 25,
        eventLoopLagMs: 5,
        jsFps: 58,
        memoryMB: 300,
        uiFps: 59,
      }),
      makeSample({
        cpuUsage: 70,
        eventLoopLagMs: 80,
        jsFps: 42,
        maxFrameMs: 50,
        memoryMB: 420,
        nativeMetricsAvailable: false,
        uiFps: 45,
      }),
    ]);

    expect(summary.avgJsFps).toBe(50);
    expect(summary.minJsFps).toBe(42);
    expect(summary.minUiFps).toBe(45);
    expect(summary.maxCpuUsage).toBe(70);
    expect(summary.maxMemoryMB).toBe(420);
    expect(summary.maxFrameMs).toBe(50);
    expect(summary.nativeSampleCount).toBe(1);
  });
});
