import { DANDAN_COMMENT_MODE, type DandanComment } from '@/services/dandanplay';
import { describe, expect, it } from 'vitest';

import {
  applyDanmakuDensityLimit,
  filterDanmakuComments,
  shouldKeepCommentMode,
  shouldKeepCommentSource,
} from './danmakuFilters';

const comment = (comment: Partial<DandanComment>): DandanComment => ({
  id: 1,
  text: 'hello',
  timeInSeconds: 10,
  mode: DANDAN_COMMENT_MODE.Scroll,
  colorHex: '#ffffff',
  user: '',
  ...comment,
});

const baseOptions = {
  curEpOffset: 0,
  danmakuFilter: 0,
  danmakuModeFilter: 0,
  danmakuDensityLimit: 0,
  width: 800,
  height: 450,
  heightRatio: 0.5,
  speed: 120,
  playbackRate: 1,
  fontSize: 24,
};

describe('danmakuFilters', () => {
  it('filters comments by source bitmask', () => {
    expect(shouldKeepCommentSource(comment({ user: '[BiliBili] user' }), 1)).toBe(false);
    expect(shouldKeepCommentSource(comment({ user: '[Gamer] user' }), 2)).toBe(false);
    expect(shouldKeepCommentSource(comment({ user: '[DandanPlay]' }), 4)).toBe(false);
    expect(shouldKeepCommentSource(comment({ user: 'plain-user' }), 8)).toBe(false);
    expect(shouldKeepCommentSource(comment({ user: '[BiliBili] user' }), 8)).toBe(true);
  });

  it('filters comments by mode bitmask', () => {
    expect(shouldKeepCommentMode(comment({ mode: DANDAN_COMMENT_MODE.Bottom }), 1)).toBe(false);
    expect(shouldKeepCommentMode(comment({ mode: DANDAN_COMMENT_MODE.Top }), 2)).toBe(false);
    expect(shouldKeepCommentMode(comment({ mode: DANDAN_COMMENT_MODE.Scroll }), 4)).toBe(false);
    expect(shouldKeepCommentMode(comment({ mode: DANDAN_COMMENT_MODE.ScrollBottom }), 4)).toBe(
      false,
    );
    expect(shouldKeepCommentMode(comment({ mode: DANDAN_COMMENT_MODE.Top }), 4)).toBe(true);
  });

  it('applies episode offset before filtering', () => {
    expect(
      filterDanmakuComments([comment({ id: 1, timeInSeconds: 3 })], {
        ...baseOptions,
        curEpOffset: 2,
      }),
    ).toEqual([expect.objectContaining({ id: 1, timeInSeconds: 5 })]);
  });

  it('sorts comments when density limit is disabled', () => {
    expect(
      applyDanmakuDensityLimit(
        [comment({ id: 2, timeInSeconds: 20 }), comment({ id: 1, timeInSeconds: 10 })],
        baseOptions,
      ).map((item) => item.id),
    ).toEqual([1, 2]);
  });

  it('keeps early comments and limits dense later buckets', () => {
    const comments = [
      comment({ id: 1, timeInSeconds: 2 }),
      comment({ id: 2, timeInSeconds: 20 }),
      comment({ id: 3, timeInSeconds: 20.2 }),
      comment({ id: 4, timeInSeconds: 20.4 }),
      comment({ id: 5, timeInSeconds: 20.6 }),
    ];

    const result = applyDanmakuDensityLimit(comments, {
      ...baseOptions,
      danmakuDensityLimit: 4,
      width: 800,
      height: 180,
      heightRatio: 1,
      fontSize: 40,
    });

    expect(result.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });
});
