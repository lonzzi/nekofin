import type { MediaSegment } from '@/services/media/types';

const key = (segment: MediaSegment) =>
  `${segment.type}:${segment.startTimeMs}:${segment.endTimeMs}`;

/** Keep manual replay, in-flight seeks and confirmed skips separate. */
export function createPlayerSegmentSkip({
  now = Date.now,
  retryDelayMs = 1500,
  maxAttempts = 3,
}: { now?: () => number; retryDelayMs?: number; maxAttempts?: number } = {}) {
  const manualTargets: number[] = [];
  let readyAfter = 0;
  const ranges = new Map<
    string,
    {
      handled: boolean;
      pending: MediaSegment | null;
      attempts: number;
      retryAt: number;
    }
  >();
  const stateFor = (segment: MediaSegment) => {
    const id = key(segment);
    let state = ranges.get(id);
    if (!state) {
      state = { handled: false, pending: null, attempts: 0, retryAt: 0 };
      ranges.set(id, state);
    }
    return state;
  };
  return {
    defer() {
      readyAfter = now() + 1500;
    },
    handleManualSeek(segments: MediaSegment[], timeMs: number) {
      if (!Number.isFinite(timeMs) || timeMs < 0) return;
      manualTargets.push(timeMs);
      if (manualTargets.length > 32) manualTargets.shift();
      for (const segment of segments) {
        if (timeMs < segment.startTimeMs || timeMs >= segment.endTimeMs) continue;
        const state = stateFor(segment);
        state.handled = true;
        state.pending = null;
      }
    },
    claim(
      segments: MediaSegment[],
      timeMs: number,
      preferences: { intro: boolean; outro: boolean },
    ) {
      if (now() < readyAfter) return null;
      const segment = segments.find(
        (entry) =>
          timeMs >= entry.startTimeMs &&
          timeMs < entry.endTimeMs &&
          preferences[entry.type === 'Intro' ? 'intro' : 'outro'],
      );
      if (!segment) return null;
      const state = stateFor(segment);
      if (manualTargets.some((time) => time >= segment.startTimeMs && time < segment.endTimeMs)) {
        state.handled = true;
      }
      if (state.handled || state.pending || state.attempts >= maxAttempts || now() < state.retryAt)
        return null;
      // A distinct identity prevents late failures from cancelling a newer retry.
      const claim = { ...segment };
      state.pending = claim;
      state.attempts += 1;
      return claim;
    },
    confirm(claim: MediaSegment) {
      const state = stateFor(claim);
      if (state.pending !== claim) return;
      state.pending = null;
      state.handled = true;
    },
    fail(claim: MediaSegment) {
      const state = stateFor(claim);
      if (state.pending !== claim) return;
      state.pending = null;
      state.retryAt = now() + retryDelayMs;
    },
  };
}

/** Leave a short tail at EOF so normal completion and next-episode handling run. */
export function automaticSegmentSeekTarget(segment: MediaSegment, durationMs: number) {
  return segment.type === 'Outro' && segment.endTimeMs >= durationMs
    ? Math.max(segment.startTimeMs, durationMs - 2000)
    : Math.min(segment.endTimeMs, durationMs);
}
