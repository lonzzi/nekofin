import { storage } from '@/lib/storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nextProvider } from 'react-i18next';
import { AppState } from 'react-native';

import { i18n } from './index';
import {
  LANGUAGE_STORAGE_KEY,
  readLanguagePreference,
  resolveLanguage,
  type LanguagePreference,
} from './language';
import { syncNativeTranslations } from './native';

const getSystemLanguageTags = () => getLocales().map((locale) => locale.languageTag);
const storedPreference = readLanguagePreference(storage.getString(LANGUAGE_STORAGE_KEY));
void i18n.changeLanguage(resolveLanguage(storedPreference, getSystemLanguageTags()));
syncNativeTranslations();

const LanguageContext = createContext<{
  languagePreference: LanguagePreference;
  setLanguagePreference: (value: LanguagePreference) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languagePreference, setPreference] = useState(storedPreference);
  const setLanguagePreference = useCallback((value: LanguagePreference) => {
    storage.set(LANGUAGE_STORAGE_KEY, value);
    void i18n.changeLanguage(resolveLanguage(value, getSystemLanguageTags()));
    syncNativeTranslations();
    setPreference(value);
  }, []);

  useEffect(() => {
    const update = () => {
      void i18n.changeLanguage(resolveLanguage(languagePreference, getSystemLanguageTags()));
      syncNativeTranslations();
    };
    update();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => subscription.remove();
  }, [languagePreference]);

  const value = useMemo(
    () => ({ languagePreference, setLanguagePreference }),
    [languagePreference, setLanguagePreference],
  );
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguagePreference() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguagePreference requires LanguageProvider');
  return context;
}
