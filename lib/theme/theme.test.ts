import { describe, expect, it } from 'vitest';

import { createAppTheme } from './theme';
import { resolveMediaHeroHeight } from './tokens';

describe('createAppTheme', () => {
  it('uses system blue for both appearances by default', () => {
    const lightTheme = createAppTheme({ colorScheme: 'light' });
    const darkTheme = createAppTheme({ colorScheme: 'dark' });

    expect(lightTheme.colors.tint).toBe('#007AFF');
    expect(darkTheme.colors.tint).toBe('#0A84FF');
  });

  it('resolves semantic backgrounds from the active color scheme', () => {
    const lightTheme = createAppTheme({ colorScheme: 'light' });
    const darkTheme = createAppTheme({ colorScheme: 'dark' });

    expect(lightTheme.colors.background).toBe('#FFFFFF');
    expect(darkTheme.colors.background).toBe('#000000');
    expect(lightTheme.colors.surface).not.toBe(darkTheme.colors.surface);
  });

  it('exposes the shared layout foundations through the theme', () => {
    const theme = createAppTheme({ colorScheme: 'light' });

    expect(theme.spacing.page).toBe(20);
    expect(theme.layout.mediaHero.heightRatio).toBe(0.75);
    expect(theme.radius.pill).toBe(999);
    expect(theme.typography.body.fontSize).toBe(16);
  });

  it('keeps media hero height within the shared app bounds', () => {
    expect(resolveMediaHeroHeight(640)).toBe(480);
    expect(resolveMediaHeroHeight(852)).toBe(520);
    expect(resolveMediaHeroHeight(1200)).toBe(520);
  });
});
