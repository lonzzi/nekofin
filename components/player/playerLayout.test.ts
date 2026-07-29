import { describe, expect, it } from 'vitest';

import { derivePlayerOverlayLayout } from './playerLayout';

describe('derivePlayerOverlayLayout', () => {
  it('keeps landscape phone controls clear of the display edges', () => {
    expect(derivePlayerOverlayLayout(844, 390)).toMatchObject({
      side: 38,
      isPortrait: false,
      isCompact: true,
      stackBottomControls: false,
      maxContentWidth: 1080,
    });
  });

  it('uses tighter insets in portrait', () => {
    expect(derivePlayerOverlayLayout(390, 844)).toMatchObject({
      side: 18,
      topExtra: 10,
      bottomExtra: 10,
      isPortrait: true,
      stackBottomControls: true,
    });
  });

  it('stacks the bottom controls on narrow portrait players', () => {
    expect(derivePlayerOverlayLayout(375, 812)).toMatchObject({
      isPortrait: true,
      stackBottomControls: true,
    });
  });

  it('keeps the split bottom toolbar compact on short landscape players', () => {
    expect(derivePlayerOverlayLayout(568, 320)).toMatchObject({
      isPortrait: false,
      isCompact: true,
      stackBottomControls: false,
    });
  });

  it('caps the inset and content width on iPad', () => {
    expect(derivePlayerOverlayLayout(1366, 1024)).toMatchObject({
      side: 61,
      isCompact: false,
      stackBottomControls: false,
      maxContentWidth: 1080,
    });
  });
});
