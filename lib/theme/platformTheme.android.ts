import type { ResolvedColorScheme } from '@/lib/contexts/ThemePreferenceContext';
import { getMaterialColors } from '@expo/ui/jetpack-compose';

import { createAppTheme } from './theme';

export function createPlatformTheme(colorScheme: ResolvedColorScheme) {
  // No seed: use the device wallpaper on Android 12+, Material 3 baseline otherwise.
  const colors = getMaterialColors({ scheme: colorScheme });
  const theme = createAppTheme({ colorScheme, accentColor: colors.primary });
  return {
    ...theme,
    colors: {
      ...theme.colors,
      background: colors.surface,
      backgroundGrouped: colors.surface,
      surface: colors.surfaceContainerLow,
      surfaceElevated: colors.surfaceContainerHigh,
      surfaceMuted: colors.surfaceContainerHighest,
      text: colors.onSurface,
      textSecondary: colors.onSurfaceVariant,
      textTertiary: colors.onSurfaceVariant,
      separator: colors.outlineVariant,
      tint: colors.primary,
      inverseText: colors.onPrimary,
      danger: colors.error,
      scrim: colors.scrim,
    },
  };
}
