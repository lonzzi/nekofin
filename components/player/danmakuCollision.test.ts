import { describe, expect, it } from 'vitest';

import {
  calculateDanmakuActiveHardLimit,
  compareDanmakuFallbackLanes,
  DANMAKU_MAX_ACTIVE_LIMIT,
  DANMAKU_SCROLL_DIRECTION,
  evaluateScrollingDanmakuEntry,
  isDanmakuLaneBlockedAtTime,
  isScrollingDanmakuEntrySafe,
  scoreDanmakuFallbackLane,
  selectDanmakuFallbackLane,
} from './danmakuCollision';

const viewportWidthPx = 1000;

describe('danmakuCollision', () => {
  it('releases a right-to-left lane at the visible edge rather than animation overscan', () => {
    const result = evaluateScrollingDanmakuEntry({
      previous: {
        direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
        leftPx: -150,
        speedPxPerMediaMs: 0.1,
        widthPx: 100,
      },
      incoming: {
        direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
        speedPxPerMediaMs: 0.5,
      },
      safeSeparationPx: 50,
      viewportWidthPx,
    });

    expect(result).toEqual({
      reason: 'previous-outside-visible-bounds',
      safe: true,
    });
  });

  it('checks right-to-left entry separation and future catch-up', () => {
    const previous = {
      direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
      leftPx: 500,
      speedPxPerMediaMs: 0.1,
      widthPx: 100,
    } as const;

    expect(
      evaluateScrollingDanmakuEntry({
        previous,
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
          speedPxPerMediaMs: 0.2,
        },
        safeSeparationPx: 50,
        viewportWidthPx,
      }),
    ).toEqual({ reason: 'future-catch-up', safe: false });

    expect(
      isScrollingDanmakuEntrySafe({
        previous,
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
          speedPxPerMediaMs: 0.14,
        },
        safeSeparationPx: 50,
        viewportWidthPx,
      }),
    ).toBe(true);

    expect(
      evaluateScrollingDanmakuEntry({
        previous: { ...previous, leftPx: 900, widthPx: 80 },
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
          speedPxPerMediaMs: 0.1,
        },
        safeSeparationPx: 30,
        viewportWidthPx,
      }),
    ).toEqual({ reason: 'entry-separation', safe: false });
  });

  it('mirrors visible-edge and catch-up checks for left-to-right danmaku', () => {
    const previous = {
      direction: DANMAKU_SCROLL_DIRECTION.LeftToRight,
      leftPx: 400,
      speedPxPerMediaMs: 0.1,
      widthPx: 100,
    } as const;

    expect(
      evaluateScrollingDanmakuEntry({
        previous,
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.LeftToRight,
          speedPxPerMediaMs: 0.2,
        },
        safeSeparationPx: 50,
        viewportWidthPx,
      }),
    ).toEqual({ reason: 'future-catch-up', safe: false });

    expect(
      isScrollingDanmakuEntrySafe({
        previous,
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.LeftToRight,
          speedPxPerMediaMs: 0.14,
        },
        safeSeparationPx: 50,
        viewportWidthPx,
      }),
    ).toBe(true);

    expect(
      evaluateScrollingDanmakuEntry({
        previous: { ...previous, leftPx: 1050 },
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.LeftToRight,
          speedPxPerMediaMs: 0.5,
        },
        safeSeparationPx: 50,
        viewportWidthPx,
      }),
    ).toEqual({
      reason: 'previous-outside-visible-bounds',
      safe: true,
    });

    expect(
      evaluateScrollingDanmakuEntry({
        previous: { ...previous, leftPx: 20 },
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.LeftToRight,
          speedPxPerMediaMs: 0.1,
        },
        safeSeparationPx: 30,
        viewportWidthPx,
      }),
    ).toEqual({ reason: 'entry-separation', safe: false });
  });

  it('never mixes opposite directions in the same active lane', () => {
    expect(
      evaluateScrollingDanmakuEntry({
        previous: {
          direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
          leftPx: -200,
          speedPxPerMediaMs: 0.1,
          widthPx: 100,
        },
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.LeftToRight,
          speedPxPerMediaMs: 0.1,
        },
        safeSeparationPx: 0,
        viewportWidthPx,
      }),
    ).toEqual({ reason: 'different-direction', safe: false });
  });

  it('keeps equal-time and future bullets blocking a lane until expiry', () => {
    const occupancy = { mediaDurationMs: 4000, scheduledMs: 10_000 };

    expect(isDanmakuLaneBlockedAtTime({ ...occupancy, atTimeMs: 9_999 })).toBe(true);
    expect(isDanmakuLaneBlockedAtTime({ ...occupancy, atTimeMs: 10_000 })).toBe(true);
    expect(isDanmakuLaneBlockedAtTime({ ...occupancy, atTimeMs: 13_999 })).toBe(true);
    expect(isDanmakuLaneBlockedAtTime({ ...occupancy, atTimeMs: 14_000 })).toBe(false);
  });

  it('fails closed for invalid geometry and velocity', () => {
    expect(
      isScrollingDanmakuEntrySafe({
        previous: {
          direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
          leftPx: 100,
          speedPxPerMediaMs: 0,
          widthPx: 100,
        },
        incoming: {
          direction: DANMAKU_SCROLL_DIRECTION.RightToLeft,
          speedPxPerMediaMs: 0.1,
        },
        safeSeparationPx: 20,
        viewportWidthPx,
      }),
    ).toBe(false);
  });

  it('provides finite hard limits for automatic and every density level', () => {
    expect(calculateDanmakuActiveHardLimit(10, 0)).toBe(20);
    expect(calculateDanmakuActiveHardLimit(10, 1)).toBe(40);
    expect(calculateDanmakuActiveHardLimit(10, 2)).toBe(30);
    expect(calculateDanmakuActiveHardLimit(10, 3)).toBe(20);
    expect(calculateDanmakuActiveHardLimit(10, 4)).toBe(10);

    for (let density = 0; density <= 4; density++) {
      const limit = calculateDanmakuActiveHardLimit(12, density);
      expect(Number.isFinite(limit)).toBe(true);
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(DANMAKU_MAX_ACTIVE_LIMIT);
    }

    expect(calculateDanmakuActiveHardLimit(10_000, 1)).toBe(DANMAKU_MAX_ACTIVE_LIMIT);
    expect(calculateDanmakuActiveHardLimit(0, 4)).toBe(0);
    expect(calculateDanmakuActiveHardLimit(10, Number.NaN)).toBe(20);
  });

  it('scores fallback lanes by occupancy, availability, then row', () => {
    const fewerActive = { activeCount: 0, availableAtMs: 9000, rowIndex: 9 };
    const earlierAvailable = { activeCount: 1, availableAtMs: 1000, rowIndex: 8 };
    const laterAvailable = { activeCount: 1, availableAtMs: 2000, rowIndex: 0 };
    const lowerRow = { activeCount: 1, availableAtMs: 1000, rowIndex: 2 };

    expect(compareDanmakuFallbackLanes(fewerActive, earlierAvailable)).toBeLessThan(0);
    expect(compareDanmakuFallbackLanes(earlierAvailable, laterAvailable)).toBeLessThan(0);
    expect(compareDanmakuFallbackLanes(lowerRow, earlierAvailable)).toBeLessThan(0);
    expect(scoreDanmakuFallbackLane(lowerRow)).toEqual([1, 1000, 2]);

    expect(
      selectDanmakuFallbackLane([laterAvailable, earlierAvailable, lowerRow, fewerActive]),
    ).toBe(fewerActive);
    expect(selectDanmakuFallbackLane([])).toBeNull();
  });
});
