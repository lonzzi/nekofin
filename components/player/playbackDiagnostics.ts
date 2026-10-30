import type { DiagnosticData } from '@/lib/performance/diagnosticReport';
import type { PerformanceEventStatus } from '@/lib/performance/performanceMetrics';
import type { MediaInfo } from 'expo-mpv';

export function activeDecoderStatus(info: Partial<MediaInfo>) {
  const current = info.hwdecCurrent?.trim();
  if (current && current !== 'no') return 'hardware';
  if (current === 'no' || (info.videoCodec && (info.width ?? 0) > 0)) return 'software';
  return 'unknown';
}

/** A stalled bridge produces one timeout, never an accumulating queue of native reads. */
export function createPlaybackDiagnosticSampler({
  read,
  active,
  record,
  timeoutMs = 10_000,
}: {
  read: () => Promise<DiagnosticData>;
  active: () => boolean;
  record: (name: string, data: DiagnosticData, status?: PerformanceEventStatus) => void;
  timeoutMs?: number;
}) {
  let pending: Promise<void> | undefined;
  return () => {
    if (pending) return pending;
    if (!active()) return Promise.resolve();
    pending = (async () => {
      const started = Date.now();
      const timeout = setTimeout(() => {
        if (active())
          record('player.snapshot.timeout', { elapsedMs: Date.now() - started }, 'error');
      }, timeoutMs);
      try {
        const data = await Promise.resolve().then(read);
        if (active()) record('player.snapshot', { ...data, readDurationMs: Date.now() - started });
      } catch (error) {
        if (active()) record('player.snapshot.failed', { error }, 'error');
      } finally {
        clearTimeout(timeout);
        pending = undefined;
      }
    })();
    return pending;
  };
}
