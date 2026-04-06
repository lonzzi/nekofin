import { storage } from '@/lib/storage';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'theme.preference';
const DEFAULT_THEME: ThemePreference = 'system';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

function applyTheme(preference: ThemePreference) {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

// Apply theme synchronously at module load time, before any component renders
const storedPreference = (storage.getString(STORAGE_KEY) as ThemePreference) || DEFAULT_THEME;
applyTheme(storedPreference);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(storedPreference);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    storage.set(STORAGE_KEY, preference);
    applyTheme(preference);
  }, []);

  const contextValue = useMemo<ThemePreferenceContextValue>(
    () => ({
      themePreference,
      setThemePreference,
    }),
    [themePreference, setThemePreference],
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
