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
  it('never admits a faster follower that catches the leader within the visible viewport', () => {
    for (const direction of Object.values(DANMAKU_SCROLL_DIRECTION)) {
      for (const leaderWidth of [40, 200, 700]) {
        for (const leaderSpeed of [0.08, 0.16, 0.32]) {
          for (const followerSpeed of [0.1, 0.2, 0.4, 0.8]) {
            for (const progress of [0.1, 0.3, 0.5, 0.8]) {
              const left =
                direction === DANMAKU_SCROLL_DIRECTION.RightToLeft
                  ? 1000 - (1000 + leaderWidth) * progress
                  : -leaderWidth + (1000 + leaderWidth) * progress;
              const safe = isScrollingDanmakuEntrySafe({
                previous: {
                  direction,
                  leftPx: left,
                  widthPx: leaderWidth,
                  speedPxPerMediaMs: leaderSpeed,
                },
                incoming: { direction, speedPxPerMediaMs: followerSpeed },
                viewportWidthPx: 1000,
                safeSeparationPx: 30,
              });
              if (!safe) continue;
              for (let elapsed = 0; elapsed < 15000; elapsed += 25) {
                if (direction === DANMAKU_SCROLL_DIRECTION.RightToLeft) {
                  const right = left + leaderWidth - leaderSpeed * elapsed;
                  const head = 1000 - followerSpeed * elapsed;
                  if (right <= 0 || head <= 0) break;
                  expect(head - right).toBeGreaterThanOrEqual(30 - 1e-6);
                } else {
                  const leaderLeft = left + leaderSpeed * elapsed;
                  const head = followerSpeed * elapsed;
                  if (leaderLeft >= 1000 || head >= 1000) break;
                  expect(leaderLeft - head).toBeGreaterThanOrEqual(30 - 1e-6);
                }
              }
            }
          }
        }
      }
    }
  });
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
