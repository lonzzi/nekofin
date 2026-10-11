import { useResolvedColorScheme } from '@/lib/contexts/ThemePreferenceContext';
import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type PropsWithChildren,
} from 'react';

import { createPlatformTheme } from './platformTheme';
import type { AppTheme } from './theme';

export const OuterThemeContext = createContext<AppTheme | null>(null);
export function useOuterTheme() {
  const colorScheme = useResolvedColorScheme();
  return useMemo(() => createPlatformTheme(colorScheme), [colorScheme]);
}
export function OuterThemeProvider({ children }: PropsWithChildren) {
  const theme = useOuterTheme();
  return <OuterThemeContext.Provider value={theme}>{children}</OuterThemeContext.Provider>;
}
export function withOuterTheme<P extends object>(Screen: ComponentType<P>) {
  return function OuterScreen(props: P) {
    return (
      <OuterThemeProvider>
        <Screen {...props} />
      </OuterThemeProvider>
    );
  };
}
export const useIsOuterTheme = () => useContext(OuterThemeContext) !== null;
