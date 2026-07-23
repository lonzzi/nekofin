import { describe, expect, it } from 'vitest';

import { DETAIL_STACK_SCREEN_OPTIONS } from './nativeStackConfig';

describe('native stack configuration', () => {
  it('uses the native iOS edge gesture without competing with detail carousels', () => {
    expect(DETAIL_STACK_SCREEN_OPTIONS).toMatchObject({
      fullScreenGestureEnabled: false,
      gestureEnabled: true,
      headerTitle: '',
      headerTransparent: true,
      headerBlurEffect: 'none',
    });
  });
});
