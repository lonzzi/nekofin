import { describe, expect, it } from 'vitest';

import {
  calculateSeekGesture,
  calculateVerticalGestureValue,
  clamp,
  formatSeekOffsetText,
  getVerticalGestureMode,
  isHorizontalPan,
  isVerticalPan,
} from './gestureMath';

describe('gestureMath', () => {
  it('clamps values into bounds', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('detects horizontal and vertical intent with a dead zone', () => {
    expect(isHorizontalPan(30, 5)).toBe(true);
    expect(isHorizontalPan(10, 10)).toBe(false);
    expect(isVerticalPan(5, 30)).toBe(true);
    expect(isVerticalPan(10, 10)).toBe(false);
  });

  it('calculates seek time from horizontal translation', () => {
    expect(
      calculateSeekGesture({
        translationX: 200,
        screenWidth: 400,
        duration: 300000,
        startTime: 60000,
      }),
    ).toEqual({
      offset: 90000,
      time: 150000,
    });

    expect(
      calculateSeekGesture({
        translationX: -400,
        screenWidth: 400,
        duration: 300000,
        startTime: 10000,
      }).time,
    ).toBe(0);
  });

  it('formats seek offset text', () => {
    expect(formatSeekOffsetText(1200)).toBe('+1s');
    expect(formatSeekOffsetText(-5600)).toBe('-6s');
    expect(formatSeekOffsetText(0)).toBe('0s');
  });

  it('calculates vertical slider mode and value', () => {
    expect(getVerticalGestureMode(100, 400)).toBe('brightness');
    expect(getVerticalGestureMode(250, 400)).toBe('volume');
    expect(
      calculateVerticalGestureValue({
        translationY: -60,
        screenWidth: 400,
        startValue: 0.4,
      }),
    ).toEqual({
      offset: 0.3,
      value: 0.7,
    });
  });
});
