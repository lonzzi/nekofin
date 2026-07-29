import { DANDAN_COMMENT_MODE, type DandanComment } from '@/services/dandanplay';
import { describe, expect, it } from 'vitest';

import {
  calculateDanmakuLayout,
  calculateDanmakuRows,
  calculateDefaultDanmakuDuration,
  calculateEffectiveScrollSpeed,
  calculateScrollDurationMs,
  createActiveDanmakuBullet,
  estimateDanmakuTextWidth,
  getDanmakuBulletTop,
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
    ).toBe(6);
    expect(
      calculateDanmakuRows({ height: 800, heightRatio: 0.5, lineHeight: 32, density: 1 }),
    ).toBe(12);
    expect(calculateDanmakuLayout(12)).toEqual({ topRows: 12, bottomRows: 12, scrollRows: 12 });
  });

  it('estimates mixed CJK and latin text width', () => {
    expect(estimateDanmakuTextWidth({ text: '猫ab', fontSize: 20, containerWidth: 400 })).toBe(60);
    expect(
      estimateDanmakuTextWidth({ text: '猫'.repeat(100), fontSize: 20, containerWidth: 400 }),
    ).toBe(800);
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
    ).toBe(168);
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
