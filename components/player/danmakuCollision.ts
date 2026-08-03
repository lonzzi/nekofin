export const DANMAKU_SCROLL_DIRECTION = {
  LeftToRight: 'left-to-right',
  RightToLeft: 'right-to-left',
} as const;

export type DanmakuScrollDirection =
  (typeof DANMAKU_SCROLL_DIRECTION)[keyof typeof DANMAKU_SCROLL_DIRECTION];

export type ActiveScrollingDanmakuSnapshot = {
  direction: DanmakuScrollDirection;
  /** Current left edge in viewport coordinates. */
  leftPx: number;
  /** Positive rendered width, excluding any animation overscan. */
  widthPx: number;
  /** Positive velocity on the media timeline. */
  speedPxPerMediaMs: number;
};

export type IncomingScrollingDanmakuSnapshot = {
  direction: DanmakuScrollDirection;
  /** Positive velocity on the media timeline. */
  speedPxPerMediaMs: number;
};

export type DanmakuCollisionReason =
  | 'safe'
  | 'previous-outside-visible-bounds'
  | 'different-direction'
  | 'invalid-input'
  | 'entry-separation'
  | 'future-catch-up';

export type DanmakuCollisionResult = {
  safe: boolean;
  reason: DanmakuCollisionReason;
};

export type EvaluateScrollingDanmakuEntryInput = {
  previous: ActiveScrollingDanmakuSnapshot;
  incoming: IncomingScrollingDanmakuSnapshot;
  viewportWidthPx: number;
  safeSeparationPx: number;
};

const isScrollDirection = (value: unknown): value is DanmakuScrollDirection =>
  value === DANMAKU_SCROLL_DIRECTION.LeftToRight || value === DANMAKU_SCROLL_DIRECTION.RightToLeft;

const safeResult = (reason: DanmakuCollisionReason): DanmakuCollisionResult => ({
  reason,
  safe: true,
});

const unsafeResult = (reason: DanmakuCollisionReason): DanmakuCollisionResult => ({
  reason,
  safe: false,
});

/**
 * Checks whether an incoming scrolling danmaku can enter behind another one.
 *
 * Collision time is calculated only until the visible viewport edge. Extra
 * animation distance used to keep views offscreen must not reserve a lane.
 * The left-to-right case mirrors the right-to-left calculation.
 */
export function evaluateScrollingDanmakuEntry({
  previous,
  incoming,
  viewportWidthPx,
  safeSeparationPx,
}: EvaluateScrollingDanmakuEntryInput): DanmakuCollisionResult {
  if (!isScrollDirection(previous.direction) || !isScrollDirection(incoming.direction)) {
    return unsafeResult('invalid-input');
  }

  if (previous.direction !== incoming.direction) {
    return unsafeResult('different-direction');
  }

  if (
    !Number.isFinite(previous.leftPx) ||
    !Number.isFinite(previous.widthPx) ||
    previous.widthPx <= 0 ||
    !Number.isFinite(previous.speedPxPerMediaMs) ||
    previous.speedPxPerMediaMs <= 0 ||
    !Number.isFinite(incoming.speedPxPerMediaMs) ||
    incoming.speedPxPerMediaMs <= 0 ||
    !Number.isFinite(viewportWidthPx) ||
    viewportWidthPx <= 0 ||
    !Number.isFinite(safeSeparationPx) ||
    safeSeparationPx < 0
  ) {
    return unsafeResult('invalid-input');
  }

  if (incoming.direction === DANMAKU_SCROLL_DIRECTION.RightToLeft) {
    const previousRightPx = previous.leftPx + previous.widthPx;

    if (previousRightPx <= 0) {
      return safeResult('previous-outside-visible-bounds');
    }

    if (previousRightPx + safeSeparationPx > viewportWidthPx) {
      return unsafeResult('entry-separation');
    }

    const previousSafeBoundaryExitMs =
      (previousRightPx + safeSeparationPx) / previous.speedPxPerMediaMs;
    const incomingHeadExitMs = viewportWidthPx / incoming.speedPxPerMediaMs;

    return previousSafeBoundaryExitMs > incomingHeadExitMs
      ? unsafeResult('future-catch-up')
      : safeResult('safe');
  }

  const previousLeftPx = previous.leftPx;

  if (previousLeftPx >= viewportWidthPx) {
    return safeResult('previous-outside-visible-bounds');
  }

  if (previousLeftPx - safeSeparationPx < 0) {
    return unsafeResult('entry-separation');
  }

  const previousSafeBoundaryExitMs =
    (viewportWidthPx - (previousLeftPx - safeSeparationPx)) / previous.speedPxPerMediaMs;
  const incomingHeadExitMs = viewportWidthPx / incoming.speedPxPerMediaMs;

  return previousSafeBoundaryExitMs > incomingHeadExitMs
    ? unsafeResult('future-catch-up')
    : safeResult('safe');
}

export function isScrollingDanmakuEntrySafe(input: EvaluateScrollingDanmakuEntryInput): boolean {
  return evaluateScrollingDanmakuEntry(input).safe;
}

/**
 * Whether an existing bullet must still reserve its lane at a media timestamp.
 * Equal-time and future entries deliberately fail closed so a same-batch burst
 * cannot admit multiple bullets into one lane before the first one advances.
 */
export function isDanmakuLaneBlockedAtTime({
  atTimeMs,
  mediaDurationMs,
  scheduledMs,
}: {
  atTimeMs: number;
  mediaDurationMs: number;
  scheduledMs: number;
}): boolean {
  if (
    !Number.isFinite(atTimeMs) ||
    !Number.isFinite(mediaDurationMs) ||
    mediaDurationMs <= 0 ||
    !Number.isFinite(scheduledMs)
  ) {
    return true;
  }

  return atTimeMs < scheduledMs + mediaDurationMs;
}

export type DanmakuDensityLevel = 0 | 1 | 2 | 3 | 4;

/** 0 automatic, then 1 loose, 2 standard, 3 strict, and 4 minimal. */
export const DANMAKU_ACTIVE_PER_ROW_BY_DENSITY = [2, 4, 3, 2, 1] as const;
export const DANMAKU_MAX_TRACK_ROWS = 64;
export const DANMAKU_MAX_ACTIVE_LIMIT = 96;

/**
 * Returns a finite hard cap for every density profile. Density 0 is automatic;
 * levels 1 through 4 progressively reduce the allowed number of active items.
 */
export function calculateDanmakuActiveHardLimit(rows: number, density: number): number {
  if (!Number.isFinite(rows) || rows <= 0) return 0;

  const safeRows = Math.min(DANMAKU_MAX_TRACK_ROWS, Math.max(0, Math.trunc(rows)));
  const safeDensity = Number.isFinite(density) ? Math.min(4, Math.max(0, Math.trunc(density))) : 0;
  const activePerRow = DANMAKU_ACTIVE_PER_ROW_BY_DENSITY[safeDensity];

  return Math.min(DANMAKU_MAX_ACTIVE_LIMIT, safeRows * activePerRow);
}

export type DanmakuFallbackLaneCandidate = {
  activeCount: number;
  availableAtMs: number;
  rowIndex: number;
};

export type DanmakuFallbackLaneScore = readonly [
  activeCount: number,
  availableAtMs: number,
  rowIndex: number,
];

const INVALID_SCORE = Number.MAX_SAFE_INTEGER;

const normalizeNonNegativeScore = (value: number, integer = false): number => {
  if (!Number.isFinite(value) || value < 0) return INVALID_SCORE;
  return integer ? Math.trunc(value) : value;
};

/** Lower tuples are preferred lexicographically. */
export function scoreDanmakuFallbackLane(
  lane: DanmakuFallbackLaneCandidate,
): DanmakuFallbackLaneScore {
  return [
    normalizeNonNegativeScore(lane.activeCount, true),
    normalizeNonNegativeScore(lane.availableAtMs),
    normalizeNonNegativeScore(lane.rowIndex, true),
  ];
}

export function compareDanmakuFallbackLanes(
  left: DanmakuFallbackLaneCandidate,
  right: DanmakuFallbackLaneCandidate,
): number {
  const leftScore = scoreDanmakuFallbackLane(left);
  const rightScore = scoreDanmakuFallbackLane(right);

  for (let index = 0; index < leftScore.length; index++) {
    if (leftScore[index] < rightScore[index]) return -1;
    if (leftScore[index] > rightScore[index]) return 1;
  }

  return 0;
}

export function selectDanmakuFallbackLane<T extends DanmakuFallbackLaneCandidate>(
  lanes: readonly T[],
): T | null {
  let selected: T | null = null;

  for (const lane of lanes) {
    if (selected == null || compareDanmakuFallbackLanes(lane, selected) < 0) {
      selected = lane;
    }
  }

  return selected;
}
