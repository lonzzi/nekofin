import { storage } from '@/lib/storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  colorScheme: ResolvedColorScheme;
  setThemePreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'theme.preference';
const DEFAULT_THEME: ThemePreference = 'system';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

function applyTheme(preference: ThemePreference) {
  Appearance.setColorScheme((preference === 'system' ? 'auto' : preference) as ColorSchemeName);
}

function resolveColorScheme(colorScheme: ColorSchemeName | null | undefined): ResolvedColorScheme {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

// Apply theme synchronously at module load time, before any component renders
const storedPreference = (storage.getString(STORAGE_KEY) as ThemePreference) || DEFAULT_THEME;
applyTheme(storedPreference);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(storedPreference);
  const [systemColorScheme, setSystemColorScheme] = useState<ResolvedColorScheme>(() =>
    resolveColorScheme(Appearance.getColorScheme()),
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(resolveColorScheme(colorScheme));
    });

    return () => subscription.remove();
  }, []);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    storage.set(STORAGE_KEY, preference);
    applyTheme(preference);
  }, []);

  const contextValue = useMemo<ThemePreferenceContextValue>(
    () => ({
      themePreference,
      colorScheme: themePreference === 'system' ? systemColorScheme : themePreference,
      setThemePreference,
    }),
    [themePreference, systemColorScheme, setThemePreference],
  );

  return (
    <ThemePreferenceContext.Provider value={contextValue}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return ctx;
}

export function useResolvedColorScheme() {
  return useThemePreference().colorScheme;
}
