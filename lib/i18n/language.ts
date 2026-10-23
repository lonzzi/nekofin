export const supportedLanguages = ['zh-Hans', 'en'] as const;
export type AppLanguage = (typeof supportedLanguages)[number];
export type LanguagePreference = AppLanguage | 'system';
export const LANGUAGE_STORAGE_KEY = 'language.preference';

export function readLanguagePreference(value: string | undefined): LanguagePreference {
  return value === 'en' || value === 'zh-Hans' ? value : 'system';
}

export function resolveLanguage(
  preference: LanguagePreference,
  languageTags: readonly string[],
): AppLanguage {
  if (preference !== 'system') return preference;
  for (const tag of languageTags) {
    const language = tag.toLowerCase().split(/[-_]/)[0];
    if (language === 'zh') return 'zh-Hans';
    if (language === 'en') return 'en';
  }
  return 'zh-Hans';
}
