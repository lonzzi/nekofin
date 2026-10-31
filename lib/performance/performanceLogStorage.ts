import { storage } from '@/lib/storage';

import { clearDiagnosticLogFiles, diagnosticLogFileBytes } from './diagnosticLogFiles';
import { sanitizeDiagnosticData } from './diagnosticReport';
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
  clearDiagnosticLogFiles();
}

export function getStoredPerformanceLogBytes() {
  return (storage.getString(PERFORMANCE_LOG_STORAGE_KEY)?.length ?? 0) + diagnosticLogFileBytes();
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
      events: Array.isArray(parsed.events)
        ? parsed.events
            .filter(
              (event) =>
                event &&
                Number.isFinite(event.timestamp) &&
                typeof event.name === 'string' &&
                typeof event.type === 'string' &&
                typeof event.status === 'string',
            )
            .map((event) => sanitizeDiagnosticData(event) as PerformanceEvent)
        : [],
      samples: Array.isArray(parsed.samples)
        ? parsed.samples
            .filter(
              (sample) => sample && Number.isFinite(sample.timestamp) && Number.isFinite(sample.id),
            )
            .map((sample) => sanitizeDiagnosticData(sample) as PerformanceSample)
        : [],
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
      events: logs.events.map((event) => sanitizeDiagnosticData(event)),
      samples: logs.samples.map((sample) => sanitizeDiagnosticData(sample)),
      savedAt: new Date().toISOString(),
      summary: summarizePerformanceSamples(logs.samples),
    }),
  );
}
