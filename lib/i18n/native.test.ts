import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { i18n, resources } from './index';
import { syncNativeTranslations } from './native';

const native = vi.hoisted(() => ({
  platform: { OS: 'android' },
  persist: vi.fn<(json: string) => void>(),
}));
vi.mock('expo', () => ({
  requireOptionalNativeModule: () => ({ setLocalizedStrings: native.persist }),
}));
vi.mock('react-native', () => ({ Platform: native.platform }));

afterEach(() => {
  native.platform.OS = 'android';
  void i18n.changeLanguage('zh-Hans');
  vi.clearAllMocks();
});

const androidSources = [
  '../../modules/app-installer/android/src/main/java/expo/modules/appinstaller/UpdateDownloads.kt',
  '../../modules/app-installer/android/src/main/java/expo/modules/appinstaller/AppInstallerModule.kt',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
const androidMessages = androidSources.flatMap((source) =>
  [...source.matchAll(/\btext\("([^"]+)", "([^"]+)"\)/g)].map(([, key, fallback]) => ({
    key,
    fallback,
  })),
);

describe('native update translation contract', () => {
  it.each(['zh-Hans', 'en'] as const)(
    'persists every Android message using English keys and the %s locale',
    async (language) => {
      await i18n.changeLanguage(language);
      syncNativeTranslations();
      const messages = JSON.parse(native.persist.mock.lastCall![0]);
      expect(Object.keys(messages).sort()).toEqual(
        [...new Set(androidMessages.map(({ key }) => key))].sort(),
      );
      for (const { key, fallback } of androidMessages) {
        expect(key).toMatch(/^updates\.[a-zA-Z]+$/);
        expect(fallback).toBe(
          resources['zh-Hans'].translation[key as keyof typeof resources.en.translation],
        );
        expect(messages[key]).toBe(
          resources[language].translation[key as keyof typeof resources.en.translation],
        );
      }
    },
  );

  it('does not invoke the Android installer on iOS', () => {
    native.platform.OS = 'ios';
    syncNativeTranslations();
    expect(native.persist).not.toHaveBeenCalled();
  });
});
