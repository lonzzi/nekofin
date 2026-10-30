import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearStoredPerformanceLogs,
  getStoredPerformanceLogBytes,
  loadStoredPerformanceLogs,
  PERFORMANCE_LOG_STORAGE_KEY,
  saveStoredPerformanceLogs,
} from './performanceLogStorage';

const state = vi.hoisted(() => ({ values: new Map<string, string>(), removeFiles: vi.fn() }));
vi.mock('@/lib/storage', () => ({
  storage: {
    getString: (key: string) => state.values.get(key),
    set: (key: string, value: string) => state.values.set(key, value),
    delete: (key: string) => state.values.delete(key),
  },
}));
vi.mock('./diagnosticLogFiles', () => ({
  clearDiagnosticLogFiles: state.removeFiles,
  diagnosticLogFileBytes: () => 128,
}));

describe('persistent playback diagnostic records', () => {
  beforeEach(() => {
    state.values.clear();
    vi.clearAllMocks();
  });

  it('retains structured decoder information for export after reopening', () => {
    saveStoredPerformanceLogs({
      samples: [],
      events: [
        {
          id: 'playback-1',
          timestamp: 1,
          type: 'playback',
          name: 'player.snapshot',
          status: 'ok',
          data: { native: { hwdecCurrent: 'mediacodec' }, accessToken: 'secret-value' },
        },
      ],
    });
    expect(loadStoredPerformanceLogs().events[0].data).toEqual({
      native: { hwdecCurrent: 'mediacodec' },
      accessToken: '[redacted]',
    });
    expect(state.values.get(PERFORMANCE_LOG_STORAGE_KEY)).not.toContain('secret-value');
    expect(getStoredPerformanceLogBytes()).toBe(
      state.values.get(PERFORMANCE_LOG_STORAGE_KEY)!.length + 128,
    );
    clearStoredPerformanceLogs();
    expect(loadStoredPerformanceLogs().events).toEqual([]);
    expect(state.removeFiles).toHaveBeenCalledOnce();
  });

  it('handles corrupted data and sanitizes old records on hydration', () => {
    state.values.set(PERFORMANCE_LOG_STORAGE_KEY, 'invalid JSON');
    expect(loadStoredPerformanceLogs()).toEqual({ events: [], samples: [], savedAt: '' });
    state.values.set(
      PERFORMANCE_LOG_STORAGE_KEY,
      JSON.stringify({
        events: [{ detail: 'Failed https://media.test/stream?api_key=legacy-secret' }],
        samples: [],
      }),
    );
    expect(JSON.stringify(loadStoredPerformanceLogs())).not.toContain('legacy-secret');
  });
});
