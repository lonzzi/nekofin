import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { supportedLanguages } from './language';
import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';

export const resources = {
  'zh-Hans': { translation: zhHans },
  en: { translation: en },
};

// Flat English semantic keys are shared by both locales (for example, common.save).
// Keep this module free of native imports so service/model tests can use it too.
export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-Hans',
  fallbackLng: 'zh-Hans',
  supportedLngs: [...supportedLanguages],
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export const t = i18n.t;
export type TranslationKey = keyof typeof en;
export { useTranslation } from 'react-i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    keySeparator: false;
    nsSeparator: false;
    resources: { translation: typeof en };
  }
}
