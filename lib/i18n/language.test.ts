import { describe, expect, it } from 'vitest';

import { readLanguagePreference, resolveLanguage } from './language';

describe('app language selection', () => {
  it.each([undefined, '', 'fr', 'zh-CN', 'invalid'])(
    'ignores unsupported stored value %s',
    (value) => {
      expect(readLanguagePreference(value)).toBe('system');
    },
  );

  it('keeps an explicit preference ahead of device changes', () => {
    expect(resolveLanguage('en', ['zh-Hans-CN'])).toBe('en');
    expect(resolveLanguage('zh-Hans', ['en-US'])).toBe('zh-Hans');
  });

  it('uses the first supported device language and normalizes regional tags', () => {
    expect(resolveLanguage('system', ['fr-FR', 'en-GB', 'zh-CN'])).toBe('en');
    expect(resolveLanguage('system', ['zh-Hant-TW', 'en-US'])).toBe('zh-Hans');
    expect(resolveLanguage('system', ['EN_us'])).toBe('en');
  });

  it('retains the Chinese fallback for unsupported or missing device languages', () => {
    expect(resolveLanguage('system', ['ja-JP'])).toBe('zh-Hans');
    expect(resolveLanguage('system', [])).toBe('zh-Hans');
  });
});
