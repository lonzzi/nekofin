import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { useResolvedColorScheme } from '@/lib/contexts/ThemePreferenceContext';
import { useMemo } from 'react';

import { createAppTheme } from './theme';

export function useAppTheme() {
  const colorScheme = useResolvedColorScheme();
  const { accentColor } = useAccentColor();

  return useMemo(() => createAppTheme({ accentColor, colorScheme }), [accentColor, colorScheme]);
}
