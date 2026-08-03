import { DANDAN_COMMENT_MODE, type DandanComment } from '@/services/dandanplay';
import { describe, expect, it } from 'vitest';

import {
  calculateDanmakuLayout,
  calculateDanmakuRows,
  calculateDanmakuScrollTrajectory,
  calculateDefaultDanmakuDuration,
  calculateEffectiveScrollSpeed,
  calculateScrollDurationMs,
  createActiveDanmakuBullet,
  estimateDanmakuTextWidth,
  getDanmakuBulletTop,
  getDanmakuOccupiedVisualRows,
  removeActiveDanmakuBullet,
} from './danmakuLayout';

const comment = (comment: Partial<DandanComment>): DandanComment => ({
  id: 1,
  text: 'hello',
  timeInSeconds: 10,
  mode: DANDAN_COMMENT_MODE.Scroll,
  colorHex: '#ffffff',
  user: '',
  ...comment,
});

const runtime = {
  height: 400,
  heightRatio: 0.5,
  lineHeight: 32,
  layout: calculateDanmakuLayout(6),
  playbackRate: 1,
  speed: 120,
  width: 800,
};

describe('danmakuLayout', () => {
  it('calculates row counts and layout with minimums', () => {
    expect(
      calculateDanmakuRows({ height: 200, heightRatio: 0.5, lineHeight: 32, density: 1 }),
    ).toBe(3);
    expect(
      calculateDanmakuRows({ height: 800, heightRatio: 0.5, lineHeight: 32, density: 1 }),
    ).toBe(12);
    expect(calculateDanmakuLayout(12)).toEqual({ topRows: 12, bottomRows: 12, scrollRows: 12 });
    expect(
      calculateDanmakuRows({ height: 100, heightRatio: 0.3, lineHeight: 44, density: 1 }),
    ).toBe(1);
  });

  it('estimates mixed CJK and latin text width', () => {
    expect(estimateDanmakuTextWidth({ text: '猫ab', fontSize: 20 })).toBe(62);
    expect(estimateDanmakuTextWidth({ text: '猫'.repeat(100), fontSize: 20 })).toBe(2016);
  });

  it('conservatively estimates wide latin glyphs for right-moving comments', () => {
    expect(estimateDanmakuTextWidth({ text: 'W'.repeat(40), fontSize: 20 })).toBe(816);
    expect(estimateDanmakuTextWidth({ text: 'WWW', fontSize: 20 })).toBeGreaterThan(
      estimateDanmakuTextWidth({ text: 'iii', fontSize: 20 }),
    );
  });

  it('treats Japanese, Korean, and full-width glyphs as full ems', () => {
    expect(estimateDanmakuTextWidth({ text: 'あ한Ａ', fontSize: 20 })).toBe(76);
  });

  it('calculates durations and effective speed', () => {
    expect(calculateDefaultDanmakuDuration(1)).toBe(4000);
    expect(calculateDefaultDanmakuDuration(4)).toBe(1000);
    expect(calculateDefaultDanmakuDuration(10)).toBe(800);
    expect(
      calculateEffectiveScrollSpeed({
        textWidth: 400,
        speed: 120,
        width: 800,
        playbackRate: 1,
      }),
    ).toBe(144);
    expect(calculateScrollDurationMs({ width: 800, textWidth: 100, speed: 200 })).toBe(6000);
  });

  it('keeps left- and right-moving bullets fully offscreen with symmetric distances', () => {
    const leftMoving = calculateDanmakuScrollTrajectory({
      mode: DANDAN_COMMENT_MODE.Scroll,
      progress: 0,
      textWidth: 180,
      width: 800,
    });
    const rightMoving = calculateDanmakuScrollTrajectory({
      mode: DANDAN_COMMENT_MODE.ScrollBottom,
      progress: 0,
      textWidth: 180,
      width: 800,
    });

    expect(leftMoving.left).toBe(800);
    expect(rightMoving.right).toBe(0);
    expect(leftMoving.totalDistance).toBe(rightMoving.totalDistance);
  });

  it('calculates bullet top for top, bottom, and scroll modes', () => {
    expect(
      getDanmakuBulletTop({
        mode: DANDAN_COMMENT_MODE.Top,
        rowIndex: 2,
        lineHeight: 32,
        height: 400,
        heightRatio: 0.5,
        bottomRows: 6,
      }),
    ).toBe(64);
    expect(
      getDanmakuBulletTop({
        mode: DANDAN_COMMENT_MODE.Bottom,
        rowIndex: 5,
        lineHeight: 32,
        height: 400,
        heightRatio: 0.5,
        bottomRows: 6,
      }),
    ).toBe(160);
  });

  it('aligns bottom bullets to complete visual rows when the height has a remainder', () => {
    const tops = Array.from({ length: 6 }, (_, rowIndex) =>
      getDanmakuBulletTop({
        mode: DANDAN_COMMENT_MODE.Bottom,
        rowIndex,
        lineHeight: 32,
        height: 200,
        heightRatio: 1,
        bottomRows: 6,
      }),
    );
    const sparseTops = Array.from({ length: 3 }, (_, rowIndex) =>
      getDanmakuBulletTop({
        mode: DANDAN_COMMENT_MODE.Bottom,
        rowIndex,
        lineHeight: 32,
        height: 200,
        heightRatio: 1,
        bottomRows: 3,
      }),
    );

    expect(tops).toEqual([0, 32, 64, 96, 128, 160]);
    expect(sparseTops).toEqual([96, 128, 160]);
    expect(tops.every((top) => top % 32 === 0 && top + 32 <= 200)).toBe(true);
  });

  it('registers fractional bottom positions in every intersected visual row', () => {
    expect(getDanmakuOccupiedVisualRows({ lineHeight: 28, top: 308 })).toEqual([11]);
    expect(getDanmakuOccupiedVisualRows({ lineHeight: 28, top: 325.7 })).toEqual([11, 12]);
  });

  it('creates active bullets for fixed and scrolling comments', () => {
    expect(
      createActiveDanmakuBullet({
        comment: comment({ mode: DANDAN_COMMENT_MODE.Top }),
        instanceId: 41,
        rowIndex: 1,
        textWidth: 120,
        runtime,
      }),
    ).toMatchObject({
      commentId: 1,
      instanceId: 41,
      top: 32,
      durationMs: 4000,
      textWidth: 120,
    });

    expect(
      createActiveDanmakuBullet({
        comment: comment({ mode: DANDAN_COMMENT_MODE.Scroll }),
        instanceId: 42,
        rowIndex: 1,
        startOffsetMs: 100,
        scheduledMs: 200,
        textWidth: 120,
        runtime,
      }),
    ).toMatchObject({
      commentId: 1,
      instanceId: 42,
      top: 32,
      startOffsetMs: 100,
      scheduledMs: 200,
      durationMs: 9591,
    });
  });

  it('keeps collision lifetimes on the media timeline across playback rates', () => {
    const fastRuntime = { ...runtime, playbackRate: 2 };
    const fixed = createActiveDanmakuBullet({
      comment: comment({ mode: DANDAN_COMMENT_MODE.Top }),
      instanceId: 43,
      rowIndex: 1,
      textWidth: 120,
      runtime: fastRuntime,
    });
    const scrolling = createActiveDanmakuBullet({
      comment: comment({ mode: DANDAN_COMMENT_MODE.Scroll }),
      instanceId: 44,
      rowIndex: 1,
      textWidth: 120,
      runtime: fastRuntime,
    });

    expect(fixed.durationMs).toBe(2000);
    expect(fixed.mediaDurationMs).toBe(4000);
    expect(scrolling.mediaDurationMs).toBeGreaterThanOrEqual(9590);
    expect(scrolling.mediaDurationMs).toBeLessThanOrEqual(9592);
  });

  it('expires only one render instance when a source comment is recreated after seeking', () => {
    const first = createActiveDanmakuBullet({
      comment: comment({ id: 1 }),
      instanceId: 41,
      rowIndex: 1,
      textWidth: 120,
      runtime,
    });
    const recreated = createActiveDanmakuBullet({
      comment: comment({ id: 1 }),
      instanceId: 42,
      rowIndex: 2,
      textWidth: 120,
      runtime,
    });

    expect(removeActiveDanmakuBullet([first, recreated], 41)).toEqual([recreated]);
  });
});
