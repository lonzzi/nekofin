import { describe, expect, it } from 'vitest';

import { DETAIL_STACK_SCREEN_OPTIONS } from './nativeStackConfig';

describe('native stack configuration', () => {
  it('preserves the platform back gesture and native transition defaults', () => {
    expect(DETAIL_STACK_SCREEN_OPTIONS).not.toHaveProperty('fullScreenGestureEnabled');
    expect(DETAIL_STACK_SCREEN_OPTIONS).not.toHaveProperty('animation');
    expect(DETAIL_STACK_SCREEN_OPTIONS).not.toHaveProperty('animationMatchesGesture');
    expect(DETAIL_STACK_SCREEN_OPTIONS).toMatchObject({
      gestureEnabled: true,
      headerTitle: '',
      headerTransparent: true,
      headerBlurEffect: 'none',
    });
  });
});
