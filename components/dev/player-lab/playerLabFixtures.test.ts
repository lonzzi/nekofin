import { DANDAN_COMMENT_MODE } from '@/services/dandanplay';
import { describe, expect, it } from 'vitest';

import {
  generateSyntheticDanmaku,
  generateSyntheticDanmakuPreset,
  MAX_SYNTHETIC_DANMAKU,
  REAL_DANMAKU_SAMPLES,
} from './playerLabFixtures';

describe('Player Lab danmaku fixtures', () => {
  it('generates deterministic, time-sorted comments with unique ids', () => {
    const first = generateSyntheticDanmakuPreset('dense', 42);
    const second = generateSyntheticDanmakuPreset('dense', 42);

    expect(first).toEqual(second);
    expect(new Set(first.map((comment) => comment.id))).toHaveLength(first.length);
    expect(
      first.every(
        (comment, index) => index === 0 || comment.timeInSeconds >= first[index - 1].timeInSeconds,
      ),
    ).toBe(true);
  });

  it('covers every supported mode and includes long unicode text', () => {
    const comments = generateSyntheticDanmakuPreset('balanced', 7);

    expect(new Set(comments.map((comment) => comment.mode))).toEqual(
      new Set([
        DANDAN_COMMENT_MODE.Scroll,
        DANDAN_COMMENT_MODE.Top,
        DANDAN_COMMENT_MODE.Bottom,
        DANDAN_COMMENT_MODE.ScrollBottom,
      ]),
    );
    expect(comments.some((comment) => comment.text.includes('超长文本宽度估算'))).toBe(true);
    expect(comments.some((comment) => comment.text.includes('👨‍👩‍👧‍👦'))).toBe(true);
  });

  it('injects a 128-comment equal-timestamp burst', () => {
    const comments = generateSyntheticDanmakuPreset('burst', 11);
    const timestampCounts = new Map<number, number>();

    comments.forEach((comment) => {
      timestampCounts.set(
        comment.timeInSeconds,
        (timestampCounts.get(comment.timeInSeconds) ?? 0) + 1,
      );
    });

    expect(Math.max(...timestampCounts.values())).toBeGreaterThanOrEqual(128);
  });

  it('caps custom stress cases before they can allocate an unbounded list', () => {
    const comments = generateSyntheticDanmaku({
      durationSeconds: 10_000,
      commentsPerSecond: 1_000,
      burstEverySeconds: 1,
      burstSize: 1_000,
      maxComments: Number.MAX_SAFE_INTEGER,
    });

    expect(comments).toHaveLength(MAX_SYNTHETIC_DANMAKU);
  });

  it('keeps real sample metadata stable and free of bundled comment payloads', () => {
    expect(REAL_DANMAKU_SAMPLES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(REAL_DANMAKU_SAMPLES.map((sample) => sample.id))).toHaveLength(
      REAL_DANMAKU_SAMPLES.length,
    );
    expect(new Set(REAL_DANMAKU_SAMPLES.map((sample) => sample.episodeId))).toHaveLength(
      REAL_DANMAKU_SAMPLES.length,
    );
    expect(REAL_DANMAKU_SAMPLES.every((sample) => sample.episodeId > 0)).toBe(true);
  });
});
