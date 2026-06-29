import { describe, expect, it } from 'vitest';

import { formatChineseDurationFromTicks } from './duration';

describe('formatChineseDurationFromTicks', () => {
  it('formats short durations with seconds', () => {
    expect(formatChineseDurationFromTicks(30 * 10_000_000)).toBe('30 秒');
  });

  it('formats episode-length durations in Chinese', () => {
    expect(formatChineseDurationFromTicks(23 * 60 * 10_000_000 + 40 * 10_000_000)).toBe('23 分钟');
  });

  it('formats long durations with two largest units', () => {
    expect(formatChineseDurationFromTicks(2 * 60 * 60 * 10_000_000 + 5 * 60 * 10_000_000)).toBe(
      '2 小时 5 分钟',
    );
  });
});
