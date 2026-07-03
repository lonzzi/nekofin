import { storage } from '@/lib/storage';

import {
  PerformanceEvent,
  PerformanceSample,
  summarizePerformanceSamples,
} from './performanceMetrics';

export const PERFORMANCE_LOG_STORAGE_KEY = 'performanceMonitor.logs.v1';

export type StoredPerformanceLogs = {
  events: PerformanceEvent[];
  samples: PerformanceSample[];
  savedAt: string;
};

export function clearStoredPerformanceLogs() {
  storage.delete(PERFORMANCE_LOG_STORAGE_KEY);
}

export function getStoredPerformanceLogBytes() {
  return storage.getString(PERFORMANCE_LOG_STORAGE_KEY)?.length ?? 0;
}

export function loadStoredPerformanceLogs(): StoredPerformanceLogs {
  const raw = storage.getString(PERFORMANCE_LOG_STORAGE_KEY);
  if (!raw) {
    return {
      events: [],
      samples: [],
      savedAt: '',
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPerformanceLogs>;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return {
      events: [],
      samples: [],
      savedAt: '',
    };
  }
}

export function saveStoredPerformanceLogs(logs: Pick<StoredPerformanceLogs, 'events' | 'samples'>) {
  storage.set(
    PERFORMANCE_LOG_STORAGE_KEY,
    JSON.stringify({
      ...logs,
      savedAt: new Date().toISOString(),
      summary: summarizePerformanceSamples(logs.samples),
    }),
  );
}
