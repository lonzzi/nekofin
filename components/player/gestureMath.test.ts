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
      offset: 45000,
      time: 105000,
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

  it('ignores small and ambiguous movements before activation', () => {
    expect(isHorizontalPan(24, 0)).toBe(false);
    expect(isVerticalPan(0, 24)).toBe(false);
    expect(isHorizontalPan(32, 24)).toBe(false);
    expect(isVerticalPan(24, 32)).toBe(false);
    expect(isHorizontalPan(-40, 12)).toBe(true);
    expect(isVerticalPan(12, -40)).toBe(true);
  });

  it('reports the actual seek offset when reaching either end', () => {
    expect(
      calculateSeekGesture({
        translationX: -400,
        screenWidth: 400,
        duration: 300000,
        startTime: 10000,
      }),
    ).toEqual({ offset: -10000, time: 0 });
    expect(
      calculateSeekGesture({
        translationX: 400,
        screenWidth: 400,
        duration: 300000,
        startTime: 290000,
      }),
    ).toEqual({ offset: 10000, time: 300000 });
    expect(
      calculateSeekGesture({ translationX: 200, screenWidth: 400, duration: 30000, startTime: 0 })
        .time,
    ).toBe(15000);
  });

  it('formats seek offset text', () => {
    expect(formatSeekOffsetText(1200)).toBe('+00:01');
    expect(formatSeekOffsetText(-5600)).toBe('-00:05');
    expect(formatSeekOffsetText(188000)).toBe('+03:08');
    expect(formatSeekOffsetText(-552000)).toBe('-09:12');
    expect(formatSeekOffsetText(-3723000)).toBe('-01:02:03');
    expect(formatSeekOffsetText(90000000)).toBe('+25:00:00');
    expect(formatSeekOffsetText(0)).toBe('00:00');
    expect(formatSeekOffsetText(-500)).toBe('00:00');
    expect(formatSeekOffsetText(59999)).toBe('+00:59');
    expect(formatSeekOffsetText(60000)).toBe('+01:00');
  });

  it('calculates vertical slider mode and value', () => {
    expect(getVerticalGestureMode(100, 400)).toBe('brightness');
    expect(getVerticalGestureMode(250, 400)).toBe('volume');
    expect(
      calculateVerticalGestureValue({
        translationY: -60,
        screenHeight: 400,
        startValue: 0.4,
      }),
    ).toEqual({
      offset: 0.1,
      value: 0.5,
    });
  });

  it.each([
    { brightnessGestureEnabled: false, volumeGestureEnabled: true },
    { brightnessGestureEnabled: true, volumeGestureEnabled: false },
    { brightnessGestureEnabled: false, volumeGestureEnabled: false },
  ])('only activates enabled vertical gestures: %o', (settings) => {
    expect(getVerticalGestureMode(100, 400, settings)).toBe(
      settings.brightnessGestureEnabled ? 'brightness' : null,
    );
    expect(getVerticalGestureMode(300, 400, settings)).toBe(
      settings.volumeGestureEnabled ? 'volume' : null,
    );
    expect(getVerticalGestureMode(200, 400, settings)).toBe(
      settings.volumeGestureEnabled ? 'volume' : null,
    );
  });
});
