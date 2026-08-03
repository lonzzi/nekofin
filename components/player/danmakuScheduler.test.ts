import { describe, expect, it } from 'vitest';

import {
  calculateDanmakuSchedulerResolutionMs,
  calculateDanmakuWakeDelayMs,
  collectDueDanmakuEntries,
  findFirstTimedCommentAtOrAfter,
  findNextDanmakuEventTimeMs,
  normalizeDanmakuPlaybackRate,
  prepareDanmakuTimeline,
  removeExpiredDanmakuEntries,
} from './danmakuScheduler';

type Comment = { id: number; timeInSeconds: number };

const comment = (id: number, timeInSeconds: number): Comment => ({ id, timeInSeconds });

describe('danmakuScheduler', () => {
  it('normalizes timestamps and keeps equal-time comments in source order', () => {
    const timeline = prepareDanmakuTimeline([
      comment(1, 1.23),
      comment(2, 1.2),
      comment(3, 1.23),
      comment(4, Number.NaN),
      comment(5, -1),
    ]);

    expect(timeline.map(({ comment: item, timeMs }) => [item.id, timeMs])).toEqual([
      [5, 0],
      [2, 1200],
      [1, 1230],
      [3, 1230],
    ]);
  });

  it('uses a lower bound that includes all comments at the target timestamp', () => {
    const timeline = prepareDanmakuTimeline([
      comment(1, 1),
      comment(2, 2),
      comment(3, 2),
      comment(4, 3),
    ]);

    expect(findFirstTimedCommentAtOrAfter(timeline, 2000)).toBe(1);
    expect(findFirstTimedCommentAtOrAfter(timeline, 2500)).toBe(3);
  });

  it('does not deduplicate comments whose 64-bit source ids collide in JavaScript', () => {
    const timeline = prepareDanmakuTimeline([comment(1, 2), comment(1, 2)]);

    expect(timeline).toHaveLength(2);
    expect(timeline.map((entry) => entry.sourceIndex)).toEqual([0, 1]);
  });

  it('derives its resolution from the smallest positive DandanPlay interval', () => {
    const tenMillisecondTimeline = prepareDanmakuTimeline([
      comment(1, 1),
      comment(2, 1),
      comment(3, 1.01),
      comment(4, 1.2),
    ]);
    const sparseTimeline = prepareDanmakuTimeline([comment(1, 1), comment(2, 2)]);

    expect(calculateDanmakuSchedulerResolutionMs(tenMillisecondTimeline)).toBe(10);
    expect(calculateDanmakuSchedulerResolutionMs(sparseTimeline)).toBe(16);
  });

  it('coalesces all comments due within the same scheduler window', () => {
    const timeline = prepareDanmakuTimeline([
      comment(1, 1),
      comment(2, 1.01),
      comment(3, 1.01),
      comment(4, 1.03),
    ]);

    const result = collectDueDanmakuEntries({
      comments: timeline,
      maxCandidates: 16,
      startIndex: 0,
      throughTimeMs: 1016,
    });

    expect(result.due.map(({ comment: item }) => item.id)).toEqual([1, 2, 3]);
    expect(result.nextIndex).toBe(3);
  });

  it('leaves future comments queued when the current media clock has not reached them', () => {
    const timeline = prepareDanmakuTimeline([comment(1, 1), comment(2, 1.01), comment(3, 1.01)]);

    const result = collectDueDanmakuEntries({
      comments: timeline,
      maxCandidates: 16,
      startIndex: 0,
      throughTimeMs: 1000,
    });

    expect(result.due.map(({ comment: item }) => item.id)).toEqual([1]);
    expect(result.nextIndex).toBe(1);
  });

  it('advances across a same-timestamp burst while materializing a fixed candidate budget', () => {
    const timeline = prepareDanmakuTimeline(
      Array.from({ length: 128 }, (_, index) => comment(index, 1)),
    );

    const result = collectDueDanmakuEntries({
      comments: timeline,
      maxCandidates: 24,
      startIndex: 0,
      throughTimeMs: 1000,
    });

    expect(result.due).toHaveLength(24);
    expect(result.due.map(({ comment: item }) => item.id)).toEqual(
      Array.from({ length: 24 }, (_, index) => index),
    );
    expect(result.nextIndex).toBe(128);
  });

  it('skips stale due entries before applying the candidate budget', () => {
    const timeline = prepareDanmakuTimeline([
      ...Array.from({ length: 128 }, (_, index) => comment(index, 1)),
      comment(200, 9.8),
      comment(201, 9.9),
      comment(202, 10),
      comment(203, 10.1),
    ]);

    const result = collectDueDanmakuEntries({
      comments: timeline,
      maxCandidates: 2,
      minimumCandidateTimeMs: 9750,
      startIndex: 0,
      throughTimeMs: 10_000,
    });

    expect(result.due.map(({ comment: item }) => item.id)).toEqual([200, 201]);
    expect(result.nextIndex).toBe(131);
  });

  it('uses the next bullet expiration when it precedes the next comment', () => {
    const activeBullets = [
      { mediaDurationMs: 4000, scheduledMs: 1000 },
      { mediaDurationMs: 3000, scheduledMs: 1500 },
    ];

    expect(findNextDanmakuEventTimeMs({ activeBullets, nextCommentTimeMs: 6000 })).toBe(4500);
    expect(findNextDanmakuEventTimeMs({ activeBullets: [], nextCommentTimeMs: null })).toBeNull();
  });

  it('removes an expired burst in one immutable update', () => {
    const activeBullets = [
      { mediaDurationMs: 1000, scheduledMs: 1000 },
      { mediaDurationMs: 1000, scheduledMs: 1500 },
      { mediaDurationMs: 1000, scheduledMs: 2500 },
    ];

    expect(removeExpiredDanmakuEntries(activeBullets, 2200)).toEqual(activeBullets.slice(1));
    expect(removeExpiredDanmakuEntries(activeBullets, 500)).toBe(activeBullets);
  });

  it('scales wake times by rate and caps long drift-check sleeps', () => {
    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1000,
        nextCommentTimeMs: 1250,
        playbackRate: 2,
        resolutionMs: 10,
      }),
    ).toBe(125);
    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1000,
        nextCommentTimeMs: 5000,
        playbackRate: 1,
        resolutionMs: 10,
      }),
    ).toBe(1000);
    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1300,
        nextCommentTimeMs: 1250,
        playbackRate: 1,
        resolutionMs: 10,
      }),
    ).toBe(0);
    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1300,
        nextCommentTimeMs: null,
        playbackRate: 1,
        resolutionMs: 10,
      }),
    ).toBeNull();
  });

  it('normalizes invalid rates and supports slow and fast playback', () => {
    expect(normalizeDanmakuPlaybackRate(Number.NaN)).toBe(1);
    expect(normalizeDanmakuPlaybackRate(0)).toBe(1);
    expect(normalizeDanmakuPlaybackRate(0.1)).toBe(0.25);
    expect(normalizeDanmakuPlaybackRate(4)).toBe(4);

    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1000,
        nextCommentTimeMs: 1250,
        playbackRate: 0.5,
        resolutionMs: 10,
      }),
    ).toBe(500);
    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1000,
        nextCommentTimeMs: 1250,
        playbackRate: 4,
        resolutionMs: 10,
      }),
    ).toBe(63);
    expect(
      calculateDanmakuWakeDelayMs({
        currentTimeMs: 1000,
        nextCommentTimeMs: 1005,
        playbackRate: 1,
        resolutionMs: 10,
      }),
    ).toBe(16);
  });
});
