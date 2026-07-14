import { getSystemColor } from '@/constants/SystemColor';
import type { ResolvedColorScheme } from '@/lib/contexts/ThemePreferenceContext';

import { brandColors, layout, opacity, radius, sizes, spacing, typography, zIndex } from './tokens';

export type AppColorRole =
  | 'background'
  | 'backgroundGrouped'
  | 'surface'
  | 'surfaceElevated'
  | 'surfaceMuted'
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'separator'
  | 'tint'
  | 'success'
  | 'danger'
  | 'warning'
  | 'inverseText'
  | 'scrim'
  | 'mediaChrome'
  | 'mediaScrim'
  | 'mediaScrimSoft'
  | 'mediaChromeSoft'
  | 'mediaChromeBorder'
  | 'mediaTextSecondary';

export type AppTheme = ReturnType<typeof createAppTheme>;

export function createAppTheme({
  accentColor,
  colorScheme,
}: {
  accentColor: string;
  colorScheme: ResolvedColorScheme;
}) {
  const isDark = colorScheme === 'dark';

  return {
    colorScheme,
    isDark,
    colors: {
      background: getSystemColor('systemBackground', colorScheme),
      backgroundGrouped: getSystemColor('systemGroupedBackground', colorScheme),
      surface: getSystemColor('secondarySystemGroupedBackground', colorScheme),
      surfaceElevated: getSystemColor('tertiarySystemBackground', colorScheme),
      surfaceMuted: getSystemColor('systemGray6', colorScheme),
      text: getSystemColor('label', colorScheme),
      textSecondary: getSystemColor('secondaryLabel', colorScheme),
      textTertiary: getSystemColor('tertiaryLabel', colorScheme),
      separator: getSystemColor('systemGray4', colorScheme),
      tint: accentColor,
      success: getSystemColor('systemGreen', colorScheme),
      danger: getSystemColor('systemRed', colorScheme),
      warning: getSystemColor('systemOrange', colorScheme),
      inverseText: '#FFFFFF',
      scrim: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.46)',
      mediaChrome: 'rgba(0,0,0,0.62)',
      mediaScrim: 'rgba(0,0,0,0.78)',
      mediaScrimSoft: 'rgba(0,0,0,0)',
      mediaChromeSoft: 'rgba(255,255,255,0.18)',
      mediaChromeBorder: 'rgba(255,255,255,0.36)',
      mediaTextSecondary: 'rgba(255,255,255,0.86)',
    },
    media: {
      jellyfin: brandColors.jellyfin,
      emby: brandColors.emby,
    },
    spacing,
    layout,
    radius,
    sizes,
    typography,
    opacity,
    zIndex,
  } as const;
}
