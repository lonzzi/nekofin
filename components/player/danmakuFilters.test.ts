import { defaultSettings, parseDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { DANDAN_COMMENT_MODE, type DandanComment } from '@/services/dandanplay';
import { describe, expect, it, vi } from 'vitest';

import {
  applyDanmakuDensityLimit,
  filterDanmakuComments,
  shouldKeepCommentMode,
  shouldKeepCommentSource,
} from './danmakuFilters';

vi.mock('@/lib/storage', () => ({
  storage: {
    getString: vi.fn(),
    set: vi.fn(),
  },
}));

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

describe('danmaku settings persistence', () => {
  it('enables danmaku by default', () => {
    expect(parseDanmakuSettings()).toEqual(defaultSettings);
    expect(defaultSettings.enabled).toBe(true);
  });

  it('merges defaults into settings persisted before enabled was added', () => {
    const settings = parseDanmakuSettings(JSON.stringify({ opacity: 0.5, speed: 180 }));

    expect(settings).toEqual({
      ...defaultSettings,
      opacity: 0.5,
      speed: 180,
    });
    expect(settings.enabled).toBe(true);
  });

  it('migrates the legacy all-sources filter into the master switch', () => {
    const settings = parseDanmakuSettings(JSON.stringify({ opacity: 0.5, danmakuFilter: 15 }));

    expect(settings.enabled).toBe(false);
    expect(settings.danmakuFilter).toBe(0);
    expect(settings.opacity).toBe(0.5);
  });

  it('does not reinterpret settings saved with the new master switch', () => {
    const settings = parseDanmakuSettings(JSON.stringify({ enabled: true, danmakuFilter: 15 }));

    expect(settings.enabled).toBe(true);
    expect(settings.danmakuFilter).toBe(15);
  });

  it('persists an explicit overlap policy and defaults unknown values safely', () => {
    expect(parseDanmakuSettings(JSON.stringify({ collisionPolicy: 'allow' })).collisionPolicy).toBe(
      'allow',
    );
    expect(
      parseDanmakuSettings(JSON.stringify({ collisionPolicy: 'sometimes' })).collisionPolicy,
    ).toBe('avoid');
  });

  it('migrates legacy speed and offset values into the ranges exposed by the UI', () => {
    expect(parseDanmakuSettings(JSON.stringify({ curEpOffset: 60, speed: 400 }))).toMatchObject({
      curEpOffset: 5,
      speed: 240,
    });
    expect(parseDanmakuSettings(JSON.stringify({ curEpOffset: -60, speed: 40 }))).toMatchObject({
      curEpOffset: -5,
      speed: 80,
    });
  });

  it('repairs malformed and out-of-range persisted values', () => {
    const settings = parseDanmakuSettings(
      JSON.stringify({
        enabled: 'yes',
        opacity: null,
        speed: 'fast',
        fontSize: 99,
        heightRatio: -1,
        danmakuFilter: 99.8,
        danmakuModeFilter: -3,
        danmakuDensityLimit: 9,
        collisionPolicy: 'sometimes',
        curEpOffset: null,
        fontFamily: '',
        fontWeight: '950',
      }),
    );

    expect(settings).toEqual({
      ...defaultSettings,
      fontSize: 36,
      heightRatio: 0.3,
      danmakuFilter: 15,
      danmakuDensityLimit: 4,
    });
  });
});

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
    const comments = [comment({ id: 2, timeInSeconds: 20 }), comment({ id: 1, timeInSeconds: 10 })];

    expect(applyDanmakuDensityLimit(comments, baseOptions).map((item) => item.id)).toEqual([1, 2]);
    expect(comments.map((item) => item.id)).toEqual([2, 1]);
  });

  it('leaves density admission to the runtime active-view limit', () => {
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

    expect(result.map((item) => item.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('drops comments moved before the start instead of bursting them at zero', () => {
    const result = filterDanmakuComments(
      [comment({ id: 1, timeInSeconds: 0.25 }), comment({ id: 2, timeInSeconds: 1.5 })],
      { ...baseOptions, curEpOffset: -0.5 },
    );

    expect(result).toEqual([expect.objectContaining({ id: 2, timeInSeconds: 1 })]);
  });
});
