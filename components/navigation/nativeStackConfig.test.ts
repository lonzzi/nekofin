import { describe, expect, it } from 'vitest';

import { DETAIL_STACK_SCREEN_OPTIONS } from './nativeStackConfig';

describe('native stack configuration', () => {
  it('keeps detail routes interactive across the full iOS screen', () => {
    expect(DETAIL_STACK_SCREEN_OPTIONS).toMatchObject({
      fullScreenGestureEnabled: true,
      gestureEnabled: true,
      headerTitle: '',
      headerTransparent: true,
      headerBlurEffect: 'none',
    });
  });
});
