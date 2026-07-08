export type PerformanceSample = {
  id: number;
  timestamp: number;
  jsFps: number;
  rafJsFps: number;
  uiFps?: number;
  cpuUsage?: number;
  memoryMB?: number;
  deviceCurrentRefreshRate?: number;
  deviceMaxRefreshRate?: number;
  nativeMetricsAvailable: boolean;
  nativeMetricsError?: string;
  maxFrameMs: number;
  eventLoopLagMs: number;
  activeTraceCount: number;
  networkPendingCount: number;
  queryFetchingCount: number;
  queryStaleCount: number;
  queryTotalCount: number;
  jsHeapMB?: number;
};

export type PerformanceEventType = 'mark' | 'navigation' | 'network' | 'trace';

export type PerformanceEventStatus = 'ok' | 'slow' | 'error' | 'pending';

export type PerformanceEvent = {
  id: string;
  timestamp: number;
  type: PerformanceEventType;
  name: string;
  detail?: string;
  durationMs?: number;
  status: PerformanceEventStatus;
};

export type PerformanceSummary = {
  avgJsFps: number;
  avgUiFps: number;
  minJsFps: number;
  minUiFps: number;
  maxCpuUsage: number;
  maxMemoryMB: number;
  maxLagMs: number;
  p95LagMs: number;
  maxFrameMs: number;
  nativeSampleCount: number;
  sampleCount: number;
};

export type RingBuffer<T> = {
  clear: () => void;
  push: (value: T) => void;
  size: () => number;
  toArray: () => T[];
};

export function createRingBuffer<T>(limit: number): RingBuffer<T> {
  const values: T[] = [];
  const resolvedLimit = Math.max(1, Math.floor(limit));

  return {
    clear: () => {
      values.length = 0;
    },
    push: (value: T) => {
      values.push(value);
      if (values.length > resolvedLimit) {
        values.splice(0, values.length - resolvedLimit);
      }
    },
    size: () => values.length,
    toArray: () => values.slice(),
  };
}

export function summarizePerformanceSamples(samples: PerformanceSample[]): PerformanceSummary {
  if (samples.length === 0) {
    return {
      avgJsFps: 0,
      avgUiFps: 0,
      minJsFps: 0,
      minUiFps: 0,
      maxCpuUsage: 0,
      maxMemoryMB: 0,
      maxLagMs: 0,
      p95LagMs: 0,
      maxFrameMs: 0,
      nativeSampleCount: 0,
      sampleCount: 0,
    };
  }

  const sortedLag = samples.map((sample) => sample.eventLoopLagMs).sort((a, b) => a - b);
  const p95Index = Math.min(sortedLag.length - 1, Math.ceil(sortedLag.length * 0.95) - 1);
  const uiFpsSamples = samples
    .map((sample) => sample.uiFps)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const cpuSamples = samples
    .map((sample) => sample.cpuUsage)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const memorySamples = samples
    .map((sample) => sample.memoryMB)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    avgJsFps: samples.reduce((sum, sample) => sum + sample.jsFps, 0) / samples.length,
    avgUiFps:
      uiFpsSamples.length > 0
        ? uiFpsSamples.reduce((sum, value) => sum + value, 0) / uiFpsSamples.length
        : 0,
    minJsFps: Math.min(...samples.map((sample) => sample.jsFps)),
    minUiFps: uiFpsSamples.length > 0 ? Math.min(...uiFpsSamples) : 0,
    maxCpuUsage: cpuSamples.length > 0 ? Math.max(...cpuSamples) : 0,
    maxMemoryMB: memorySamples.length > 0 ? Math.max(...memorySamples) : 0,
    maxLagMs: Math.max(...samples.map((sample) => sample.eventLoopLagMs)),
    p95LagMs: sortedLag[p95Index] ?? 0,
    maxFrameMs: Math.max(...samples.map((sample) => sample.maxFrameMs)),
    nativeSampleCount: samples.filter((sample) => sample.nativeMetricsAvailable).length,
    sampleCount: samples.length,
  };
}

export function formatDurationMs(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

export function formatFps(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return Math.round(value).toString();
}

export function formatMb(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}MB`;
}

export function formatPercent(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function formatHz(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${Math.round(value)}Hz`;
}

export function sanitizeNetworkUrl(input: string) {
  try {
    const url = new URL(input);
    return `${url.origin}${url.pathname}`;
  } catch {
    return input.split('?')[0] ?? input;
  }
}

export function formatRouteTarget(target: unknown) {
  if (typeof target === 'string') return target;

  if (target && typeof target === 'object' && 'pathname' in target) {
    const pathname = String((target as { pathname?: unknown }).pathname ?? 'unknown');
    const params = (target as { params?: unknown }).params;
    if (!params || typeof params !== 'object') return pathname;

    const paramKeys = Object.keys(params as Record<string, unknown>).sort();
    return paramKeys.length > 0 ? `${pathname}?${paramKeys.join(',')}` : pathname;
  }

  return 'unknown-route';
}
