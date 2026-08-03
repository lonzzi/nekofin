export type TimedDanmakuEntry<T> = {
  comment: T;
  timeMs: number;
  sourceIndex: number;
};

export type ScheduledDanmakuLifetime = {
  mediaDurationMs: number;
  scheduledMs: number;
};

export const DANMAKU_FRAME_INTERVAL_MS = 16;
export const DANMAKU_MAX_TIMER_DELAY_MS = 1000;

export function normalizeDanmakuPlaybackRate(playbackRate: number): number {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return 1;
  return Math.max(0.25, playbackRate);
}

export function prepareDanmakuTimeline<T extends { timeInSeconds: number }>(
  comments: T[],
): TimedDanmakuEntry<T>[] {
  return comments
    .map((comment, sourceIndex) => ({
      comment,
      sourceIndex,
      timeMs: Math.max(0, Math.round(comment.timeInSeconds * 1000)),
    }))
    .filter((entry) => Number.isFinite(entry.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs || a.sourceIndex - b.sourceIndex);
}

export function findFirstTimedCommentAtOrAfter<T>(
  comments: TimedDanmakuEntry<T>[],
  timeMs: number,
) {
  let low = 0;
  let high = comments.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (comments[mid].timeMs < timeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function calculateDanmakuSchedulerResolutionMs<T>(comments: TimedDanmakuEntry<T>[]): number {
  let minimumPositiveIntervalMs = Number.POSITIVE_INFINITY;

  for (let index = 1; index < comments.length; index++) {
    const intervalMs = comments[index].timeMs - comments[index - 1].timeMs;
    if (intervalMs > 0 && intervalMs < minimumPositiveIntervalMs) {
      minimumPositiveIntervalMs = intervalMs;
    }
  }

  if (!Number.isFinite(minimumPositiveIntervalMs)) {
    return DANMAKU_FRAME_INTERVAL_MS;
  }

  // DandanPlay timestamps are normally precise to 10 ms. A frame-sized ceiling
  // coalesces denser timestamps without turning the scheduler into a busy loop.
  return Math.max(10, Math.min(DANMAKU_FRAME_INTERVAL_MS, minimumPositiveIntervalMs));
}

export function collectDueDanmakuEntries<T>({
  comments,
  maxCandidates,
  minimumCandidateTimeMs = Number.NEGATIVE_INFINITY,
  startIndex,
  throughTimeMs,
}: {
  comments: TimedDanmakuEntry<T>[];
  maxCandidates: number;
  minimumCandidateTimeMs?: number;
  startIndex: number;
  throughTimeMs: number;
}) {
  const safeStartIndex = Math.min(
    comments.length,
    Math.max(0, Number.isFinite(startIndex) ? Math.trunc(startIndex) : 0),
  );

  // Advance the timeline cursor across every due entry without allocating the
  // whole interval. This keeps a same-time burst from producing an unbounded
  // array (or leaving overflow queued for the next scheduler turn).
  let low = safeStartIndex;
  let high = comments.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (comments[mid].timeMs <= throughTimeMs) low = mid + 1;
    else high = mid;
  }
  const nextIndex = low;

  // Skip stale entries before applying the materialization budget. Otherwise a
  // long JS stall could fill the fixed candidate window with comments that the
  // layer must discard, starving comments close to the current playback time.
  low = safeStartIndex;
  high = nextIndex;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (comments[mid].timeMs < minimumCandidateTimeMs) low = mid + 1;
    else high = mid;
  }
  const firstCandidateIndex = low;
  const safeCandidateLimit = Number.isFinite(maxCandidates)
    ? Math.max(0, Math.trunc(maxCandidates))
    : 0;
  const candidateEndIndex = Math.min(nextIndex, firstCandidateIndex + safeCandidateLimit);

  return {
    due: comments.slice(firstCandidateIndex, candidateEndIndex),
    nextIndex,
  };
}

export function findNextDanmakuEventTimeMs<T extends ScheduledDanmakuLifetime>({
  activeBullets,
  nextCommentTimeMs,
}: {
  activeBullets: T[];
  nextCommentTimeMs: number | null;
}): number | null {
  let nextEventTimeMs = nextCommentTimeMs;
  for (const bullet of activeBullets) {
    const expirationTimeMs = bullet.scheduledMs + bullet.mediaDurationMs;
    if (nextEventTimeMs == null || expirationTimeMs < nextEventTimeMs) {
      nextEventTimeMs = expirationTimeMs;
    }
  }
  return nextEventTimeMs;
}

export function removeExpiredDanmakuEntries<T extends ScheduledDanmakuLifetime>(
  activeBullets: T[],
  currentTimeMs: number,
): T[] {
  const hasExpiredBullet = activeBullets.some(
    (bullet) => bullet.scheduledMs + bullet.mediaDurationMs <= currentTimeMs,
  );
  if (!hasExpiredBullet) return activeBullets;
  return activeBullets.filter(
    (bullet) => bullet.scheduledMs + bullet.mediaDurationMs > currentTimeMs,
  );
}

export function calculateDanmakuWakeDelayMs({
  currentTimeMs,
  nextCommentTimeMs,
  playbackRate,
  resolutionMs,
}: {
  currentTimeMs: number;
  nextCommentTimeMs: number | null;
  playbackRate: number;
  resolutionMs: number;
}): number | null {
  if (nextCommentTimeMs == null) return null;

  const safeRate = normalizeDanmakuPlaybackRate(playbackRate);
  const dataResolutionMs =
    Number.isFinite(resolutionMs) && resolutionMs > 0 ? resolutionMs : DANMAKU_FRAME_INTERVAL_MS;
  // Never wake the JS thread more often than one display frame. DandanPlay's
  // 10 ms timestamps are still used for the media-time batching window.
  const safeWallClockResolutionMs = Math.max(DANMAKU_FRAME_INTERVAL_MS, dataResolutionMs);
  const wallClockDelayMs = (nextCommentTimeMs - currentTimeMs) / safeRate;
  if (wallClockDelayMs <= 0) return 0;

  return Math.min(
    DANMAKU_MAX_TIMER_DELAY_MS,
    Math.max(safeWallClockResolutionMs, Math.ceil(wallClockDelayMs)),
  );
}
