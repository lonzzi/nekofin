import { storage } from '@/lib/storage';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { readNativePerformanceSnapshot } from './nativePerformance';
import {
  clearStoredPerformanceLogs,
  loadStoredPerformanceLogs,
  saveStoredPerformanceLogs,
} from './performanceLogStorage';
import {
  createRingBuffer,
  formatRouteTarget,
  PerformanceEvent,
  PerformanceEventStatus,
  PerformanceEventType,
  PerformanceSample,
  PerformanceSummary,
  sanitizeNetworkUrl,
  summarizePerformanceSamples,
} from './performanceMetrics';
import { usePerformanceDiagnosticsUnlock } from './usePerformanceDiagnosticsUnlock';

export type PerformanceMonitorSettings = {
  enabled: boolean;
  networkCaptureEnabled: boolean;
  overlayVisible: boolean;
  persistentLogsEnabled: boolean;
  sampleIntervalMs: number;
  slowTraceThresholdMs: number;
};

type PerformanceMonitorSnapshot = {
  events: PerformanceEvent[];
  latestSample?: PerformanceSample;
  samples: PerformanceSample[];
  summary: PerformanceSummary;
};

type TraceHandle = {
  end: (status?: PerformanceEventStatus, detail?: string) => void;
  id: string;
};

type PerformanceMonitorContextValue = {
  beginTrace: (name: string, type?: PerformanceEventType, detail?: string) => TraceHandle;
  clear: () => void;
  exportText: () => string;
  mark: (name: string, detail?: string) => void;
  onRouteChanged: (routeKey: string) => void;
  recordInteractionStart: (source?: string) => void;
  recordEvent: (event: Omit<PerformanceEvent, 'id' | 'timestamp'>) => void;
  settings: PerformanceMonitorSettings;
  snapshot: PerformanceMonitorSnapshot;
  traceNavigation: (action: string, target: unknown) => void;
  updateSettings: (patch: Partial<PerformanceMonitorSettings>) => void;
};

type ActiveTrace = {
  detail?: string;
  name: string;
  startedAt: number;
  type: PerformanceEventType;
};

type PendingNavigationTrace = {
  id: string;
  interactionStartedAt?: number;
  startedAt: number;
  target: string;
};

type LastInteraction = {
  source: string;
  startedAt: number;
};

const STORAGE_KEY = 'performanceMonitor.settings.v1';
const SAMPLE_BUFFER_SIZE = 300;
const EVENT_BUFFER_SIZE = 240;
const LOG_PERSIST_THROTTLE_MS = 5000;
const DEFAULT_SETTINGS: PerformanceMonitorSettings = {
  enabled: false,
  networkCaptureEnabled: true,
  overlayVisible: false,
  persistentLogsEnabled: true,
  sampleIntervalMs: 1000,
  slowTraceThresholdMs: 700,
};

const EMPTY_SUMMARY = summarizePerformanceSamples([]);
const LOCKED_SETTINGS: PerformanceMonitorSettings = {
  ...DEFAULT_SETTINGS,
  enabled: false,
  networkCaptureEnabled: false,
  overlayVisible: false,
  persistentLogsEnabled: false,
};
const PerformanceMonitorContext = createContext<PerformanceMonitorContextValue | null>(null);

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function loadSettings() {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as PerformanceMonitorSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getJsHeapMB() {
  const memory = (globalThis.performance as { memory?: { usedJSHeapSize?: number } } | undefined)
    ?.memory;
  if (typeof memory?.usedJSHeapSize === 'number') {
    return memory.usedJSHeapSize / 1024 / 1024;
  }

  const hermesRuntime = (
    globalThis as {
      HermesInternal?: { getRuntimeProperties?: () => Record<string, unknown> };
    }
  ).HermesInternal;
  const runtimeProperties = hermesRuntime?.getRuntimeProperties?.();
  const heapSize = runtimeProperties?.['JS VM Heap Size'] ?? runtimeProperties?.['Heap Size'];

  return typeof heapSize === 'number' ? heapSize / 1024 / 1024 : undefined;
}

function getFetchInputMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method;
  if (typeof input === 'object' && input && 'method' in input) {
    return String((input as Request).method);
  }
  return 'GET';
}

function getFetchInputUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof input === 'object' && input && 'url' in input) {
    return String((input as Request).url);
  }
  return 'unknown';
}

function makeEventId(prefix: PerformanceEventType) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PerformanceMonitorProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { isUnlocked } = usePerformanceDiagnosticsUnlock();
  const storedLogs = useMemo(() => {
    const logs = loadStoredPerformanceLogs();
    return {
      ...logs,
      events: logs.events.slice(-EVENT_BUFFER_SIZE),
      samples: logs.samples.slice(-SAMPLE_BUFFER_SIZE),
    };
  }, []);
  const [settings, setSettings] = useState(loadSettings);
  const effectiveSettings = isUnlocked ? settings : LOCKED_SETTINGS;
  const sampleBufferRef = useRef(createRingBuffer<PerformanceSample>(SAMPLE_BUFFER_SIZE));
  const eventBufferRef = useRef(createRingBuffer<PerformanceEvent>(EVENT_BUFFER_SIZE));
  const didHydrateStoredLogsRef = useRef(false);
  const activeTracesRef = useRef(new Map<string, ActiveTrace>());
  const pendingNavigationRef = useRef<PendingNavigationTrace | null>(null);
  const lastInteractionRef = useRef<LastInteraction | null>(null);
  const sampleIdRef = useRef((storedLogs.samples[storedLogs.samples.length - 1]?.id ?? -1) + 1);
  const lastLogPersistedAtRef = useRef(0);
  const [snapshot, setSnapshot] = useState<PerformanceMonitorSnapshot>(() => ({
    events: storedLogs.events,
    latestSample: storedLogs.samples[storedLogs.samples.length - 1],
    samples: storedLogs.samples,
    summary: summarizePerformanceSamples(storedLogs.samples),
  }));

  if (!didHydrateStoredLogsRef.current) {
    storedLogs.samples.forEach((sample) => sampleBufferRef.current.push(sample));
    storedLogs.events.forEach((event) => eventBufferRef.current.push(event));
    didHydrateStoredLogsRef.current = true;
  }

  useEffect(() => {
    storage.set(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const persistLogs = useCallback(
    (force = false) => {
      if (!effectiveSettings.enabled || !effectiveSettings.persistentLogsEnabled) return;

      const timestamp = Date.now();
      if (!force && timestamp - lastLogPersistedAtRef.current < LOG_PERSIST_THROTTLE_MS) return;

      lastLogPersistedAtRef.current = timestamp;
      saveStoredPerformanceLogs({
        events: eventBufferRef.current.toArray(),
        samples: sampleBufferRef.current.toArray(),
      });
    },
    [effectiveSettings.enabled, effectiveSettings.persistentLogsEnabled],
  );

  const recordEvent = useCallback(
    (event: Omit<PerformanceEvent, 'id' | 'timestamp'>) => {
      if (!effectiveSettings.enabled) return;
      eventBufferRef.current.push({
        ...event,
        id: makeEventId(event.type),
        timestamp: Date.now(),
      });
    },
    [effectiveSettings.enabled],
  );

  const mark = useCallback(
    (name: string, detail?: string) => {
      recordEvent({ detail, name, status: 'ok', type: 'mark' });
    },
    [recordEvent],
  );

  const beginTrace = useCallback(
    (name: string, type: PerformanceEventType = 'trace', detail?: string): TraceHandle => {
      const id = makeEventId(type);
      if (!effectiveSettings.enabled) {
        return { end: () => undefined, id };
      }

      activeTracesRef.current.set(id, {
        detail,
        name,
        startedAt: now(),
        type,
      });

      return {
        end: (status: PerformanceEventStatus = 'ok', endDetail?: string) => {
          const activeTrace = activeTracesRef.current.get(id);
          if (!activeTrace) return;

          activeTracesRef.current.delete(id);
          const durationMs = now() - activeTrace.startedAt;
          const resolvedStatus =
            status === 'ok' && durationMs >= effectiveSettings.slowTraceThresholdMs
              ? 'slow'
              : status;

          recordEvent({
            detail: endDetail ?? activeTrace.detail,
            durationMs,
            name: activeTrace.name,
            status: resolvedStatus,
            type: activeTrace.type,
          });
        },
        id,
      };
    },
    [effectiveSettings.enabled, effectiveSettings.slowTraceThresholdMs, recordEvent],
  );

  const recordInteractionStart = useCallback(
    (source = 'touch') => {
      if (!effectiveSettings.enabled) return;
      lastInteractionRef.current = {
        source,
        startedAt: now(),
      };
    },
    [effectiveSettings.enabled],
  );

  const traceNavigation = useCallback(
    (action: string, target: unknown) => {
      if (!effectiveSettings.enabled) return;

      const routeTarget = formatRouteTarget(target);
      const trace = beginTrace(`${action} ${routeTarget}`, 'navigation');
      const interactionStartedAt = lastInteractionRef.current?.startedAt;
      pendingNavigationRef.current = {
        id: trace.id,
        interactionStartedAt,
        startedAt: now(),
        target: routeTarget,
      };

      setTimeout(
        () => {
          const pending = pendingNavigationRef.current;
          if (pending?.id !== trace.id) return;

          pendingNavigationRef.current = null;
          lastInteractionRef.current = null;
          trace.end('slow', `No route change observed for ${routeTarget}`);
        },
        Math.max(2500, effectiveSettings.slowTraceThresholdMs * 3),
      );
    },
    [beginTrace, effectiveSettings.enabled, effectiveSettings.slowTraceThresholdMs],
  );

  const onRouteChanged = useCallback(
    (routeKey: string) => {
      if (!effectiveSettings.enabled) return;

      const pending = pendingNavigationRef.current;
      if (!pending) {
        const routeChangedAt = now();
        const interaction = lastInteractionRef.current;
        const touchToRouteMs = interaction ? routeChangedAt - interaction.startedAt : undefined;
        lastInteractionRef.current = null;

        recordEvent({
          detail:
            touchToRouteMs == null
              ? routeKey
              : `${routeKey} · ${interaction?.source ?? 'touch'}->route ${Math.round(
                  touchToRouteMs,
                )}ms`,
          durationMs: touchToRouteMs,
          name: 'route changed',
          status:
            touchToRouteMs != null && touchToRouteMs >= effectiveSettings.slowTraceThresholdMs
              ? 'slow'
              : 'ok',
          type: 'navigation',
        });
        return;
      }

      pendingNavigationRef.current = null;
      const activeTrace = activeTracesRef.current.get(pending.id);
      if (!activeTrace) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const routeSettledAt = now();
          const durationMs = routeSettledAt - pending.startedAt;
          const touchToRouteMs =
            pending.interactionStartedAt == null
              ? undefined
              : routeSettledAt - pending.interactionStartedAt;
          lastInteractionRef.current = null;
          activeTracesRef.current.delete(pending.id);
          recordEvent({
            detail:
              touchToRouteMs == null
                ? `${pending.target} -> ${routeKey}`
                : `${pending.target} -> ${routeKey} · touch->route ${Math.round(touchToRouteMs)}ms`,
            durationMs,
            name: activeTrace.name,
            status: durationMs >= effectiveSettings.slowTraceThresholdMs ? 'slow' : 'ok',
            type: 'navigation',
          });
        });
      });
    },
    [effectiveSettings.enabled, effectiveSettings.slowTraceThresholdMs, recordEvent],
  );

  const clear = useCallback(() => {
    sampleBufferRef.current.clear();
    eventBufferRef.current.clear();
    activeTracesRef.current.clear();
    pendingNavigationRef.current = null;
    lastInteractionRef.current = null;
    clearStoredPerformanceLogs();
    lastLogPersistedAtRef.current = 0;
    setSnapshot({
      events: [],
      samples: [],
      summary: EMPTY_SUMMARY,
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<PerformanceMonitorSettings>) => {
    setSettings((current) => {
      if (current.enabled && patch.enabled === false && current.persistentLogsEnabled) {
        saveStoredPerformanceLogs({
          events: eventBufferRef.current.toArray(),
          samples: sampleBufferRef.current.toArray(),
        });
        lastLogPersistedAtRef.current = Date.now();
      }

      return { ...current, ...patch };
    });
  }, []);

  const exportText = useCallback(() => {
    const samples = sampleBufferRef.current.toArray();
    const events = eventBufferRef.current.toArray();
    const summary = summarizePerformanceSamples(samples);
    return JSON.stringify(
      {
        events,
        generatedAt: new Date().toISOString(),
        nativeMetrics: {
          lastError: samples[samples.length - 1]?.nativeMetricsError,
          sampleCount: samples.filter((sample) => sample.nativeMetricsAvailable).length,
          source: 'react-native-performance-toolkit',
        },
        samples,
        settings: effectiveSettings,
        summary,
      },
      null,
      2,
    );
  }, [effectiveSettings]);

  useEffect(() => {
    if (!effectiveSettings.enabled) return;

    let rafId = 0;
    let frameCount = 0;
    let lastFrameAt = now();
    let maxFrameMs = 0;
    let lastSampleAt = now();
    let expectedSampleAt = lastSampleAt + effectiveSettings.sampleIntervalMs;
    let isRunning = true;

    readNativePerformanceSnapshot();

    const onFrame = (timestamp: number) => {
      if (!isRunning) return;

      const frameDelta = timestamp - lastFrameAt;
      if (frameDelta > maxFrameMs) maxFrameMs = frameDelta;
      lastFrameAt = timestamp;
      frameCount += 1;
      rafId = requestAnimationFrame(onFrame);
    };

    rafId = requestAnimationFrame(onFrame);

    const timer = setInterval(() => {
      const currentTime = now();
      const elapsedMs = Math.max(1, currentTime - lastSampleAt);
      const eventLoopLagMs = Math.max(0, currentTime - expectedSampleAt);
      const queryCache = queryClient.getQueryCache().getAll();
      const queryFetchingCount = queryCache.filter(
        (query) => query.state.fetchStatus === 'fetching',
      ).length;
      const queryStaleCount = queryCache.filter((query) => query.isStale()).length;
      const rafJsFps = Math.min(120, (frameCount / elapsedMs) * 1000);
      const nativeSnapshot = readNativePerformanceSnapshot();
      const sample: PerformanceSample = {
        activeTraceCount: activeTracesRef.current.size,
        cpuUsage: nativeSnapshot.cpuUsage,
        deviceCurrentRefreshRate: nativeSnapshot.currentRefreshRate,
        deviceMaxRefreshRate: nativeSnapshot.maxRefreshRate,
        eventLoopLagMs,
        id: sampleIdRef.current,
        jsFps: nativeSnapshot.jsFps ?? rafJsFps,
        maxFrameMs,
        memoryMB: nativeSnapshot.memoryMB,
        nativeMetricsAvailable: nativeSnapshot.available,
        nativeMetricsError: nativeSnapshot.error,
        networkPendingCount: Array.from(activeTracesRef.current.values()).filter(
          (trace) => trace.type === 'network',
        ).length,
        queryFetchingCount,
        queryStaleCount,
        queryTotalCount: queryCache.length,
        rafJsFps,
        timestamp: Date.now(),
        jsHeapMB: getJsHeapMB(),
        uiFps: nativeSnapshot.uiFps,
      };

      sampleIdRef.current += 1;
      sampleBufferRef.current.push(sample);

      const samples = sampleBufferRef.current.toArray();
      setSnapshot({
        events: eventBufferRef.current.toArray(),
        latestSample: sample,
        samples,
        summary: summarizePerformanceSamples(samples),
      });
      persistLogs();

      frameCount = 0;
      maxFrameMs = 0;
      lastSampleAt = currentTime;
      expectedSampleAt = currentTime + effectiveSettings.sampleIntervalMs;
    }, effectiveSettings.sampleIntervalMs);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
      clearInterval(timer);
    };
  }, [effectiveSettings.enabled, effectiveSettings.sampleIntervalMs, persistLogs, queryClient]);

  useEffect(() => {
    if (!effectiveSettings.enabled || !effectiveSettings.networkCaptureEnabled) return;

    const originalFetch = globalThis.fetch;
    const monitoredFetch: typeof fetch = async (input, init) => {
      const method = getFetchInputMethod(input, init);
      const url = getFetchInputUrl(input);
      const trace = beginTrace(`${method} ${sanitizeNetworkUrl(url)}`, 'network');

      try {
        const response = await originalFetch(input, init);
        trace.end(response.ok ? 'ok' : 'error', `${response.status} ${sanitizeNetworkUrl(url)}`);
        return response;
      } catch (error) {
        trace.end('error', error instanceof Error ? error.message : sanitizeNetworkUrl(url));
        throw error;
      }
    };

    globalThis.fetch = monitoredFetch;

    return () => {
      if (globalThis.fetch === monitoredFetch) {
        globalThis.fetch = originalFetch;
      }
    };
  }, [beginTrace, effectiveSettings.enabled, effectiveSettings.networkCaptureEnabled]);

  const contextValue = useMemo<PerformanceMonitorContextValue>(
    () => ({
      beginTrace,
      clear,
      exportText,
      mark,
      onRouteChanged,
      recordInteractionStart,
      recordEvent,
      settings: effectiveSettings,
      snapshot,
      traceNavigation,
      updateSettings,
    }),
    [
      beginTrace,
      clear,
      exportText,
      mark,
      onRouteChanged,
      recordInteractionStart,
      recordEvent,
      effectiveSettings,
      snapshot,
      traceNavigation,
      updateSettings,
    ],
  );

  return (
    <PerformanceMonitorContext.Provider value={contextValue}>
      {children}
    </PerformanceMonitorContext.Provider>
  );
}

export function PerformanceRouteObserver() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const { onRouteChanged, settings } = usePerformanceMonitor();
  const lastRouteKeyRef = useRef('');

  useEffect(() => {
    if (!settings.enabled) return;

    const paramKeys = Object.keys(params).sort();
    const routeKey = paramKeys.length > 0 ? `${pathname}?${paramKeys.join(',')}` : pathname;
    if (routeKey === lastRouteKeyRef.current) return;

    lastRouteKeyRef.current = routeKey;
    onRouteChanged(routeKey);
  }, [onRouteChanged, params, pathname, settings.enabled]);

  return null;
}

export function PerformanceInteractionCapture({ children }: PropsWithChildren) {
  const { recordInteractionStart, settings } = usePerformanceMonitor();

  return (
    <View
      style={styles.interactionCapture}
      onTouchStart={settings.enabled ? () => recordInteractionStart() : undefined}
    >
      {children}
    </View>
  );
}

export function usePerformanceMonitor() {
  const context = useContext(PerformanceMonitorContext);
  if (!context) {
    throw new Error('usePerformanceMonitor must be used within PerformanceMonitorProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  interactionCapture: {
    flex: 1,
  },
});
