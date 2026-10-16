import { describe, expect, it } from 'vitest';

import {
  formatChineseDurationFromTicks,
  formatDurationFromTicks,
  formatTimeWorklet,
} from './duration';

describe('duration formatting', () => {
  it.each([
    [5, '00:05'],
    [59.999, '00:59'],
    [60, '01:00'],
    [3599, '59:59'],
    [3600, '01:00:00'],
    [90061, '25:01:01'],
  ])('keeps library and player output consistent for %s seconds', (seconds, expected) => {
    expect(formatDurationFromTicks(seconds * 10_000_000)).toBe(expected);
    expect(formatTimeWorklet(seconds * 1000)).toBe(expected);
  });

  it('preserves missing runtime labels', () => {
    expect(formatDurationFromTicks(undefined)).toBe('');
    expect(formatDurationFromTicks(null)).toBe('');
    expect(formatDurationFromTicks(0)).toBe('');
    expect(formatChineseDurationFromTicks(undefined)).toBe('');
  });

  it('preserves compact unit labels and total hours', () => {
    expect(formatDurationFromTicks(5 * 10_000_000, { showUnits: true })).toBe('5s');
    expect(formatDurationFromTicks(3661 * 10_000_000, { showUnits: true })).toBe('1h1m1s');
    expect(formatDurationFromTicks(90061 * 10_000_000, { showUnits: true })).toBe('25h1m1s');
    expect(formatChineseDurationFromTicks(90061 * 10_000_000)).toBe('25 小时 1 分钟');
  });
});

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
