import type { ResolvedColorScheme } from '@/lib/contexts/ThemePreferenceContext';

import { createAppTheme } from './theme';

// Native iOS semantic roles; system controls remain rendered by SwiftUI.
export function createPlatformTheme(colorScheme: ResolvedColorScheme) {
  return createAppTheme({ colorScheme });
}
