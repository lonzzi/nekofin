import { describe, expect, it } from 'vitest';

import { createAppTheme } from './theme';

describe('createAppTheme', () => {
  it('uses the current account accent as the tint color', () => {
    const theme = createAppTheme({ accentColor: '#123456', colorScheme: 'light' });

    expect(theme.colors.tint).toBe('#123456');
  });

  it('resolves semantic backgrounds from the active color scheme', () => {
    const lightTheme = createAppTheme({ accentColor: '#123456', colorScheme: 'light' });
    const darkTheme = createAppTheme({ accentColor: '#123456', colorScheme: 'dark' });

    expect(lightTheme.colors.background).toBe('#FFFFFF');
    expect(darkTheme.colors.background).toBe('#000000');
    expect(lightTheme.colors.surface).not.toBe(darkTheme.colors.surface);
  });

  it('exposes the shared layout foundations through the theme', () => {
    const theme = createAppTheme({ accentColor: '#123456', colorScheme: 'light' });

    expect(theme.spacing.page).toBe(20);
    expect(theme.radius.pill).toBe(999);
    expect(theme.typography.body.fontSize).toBe(16);
  });
});
