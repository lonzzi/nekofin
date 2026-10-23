import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatDate, formatList } from './formatters';
import { i18n, t } from './index';

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('zh-Hans');
});

describe('app-language formatting', () => {
  it('updates premiere dates when the selected app language changes', async () => {
    const date = '2024-05-04T12:00:00';
    expect(formatDate(date)).toBe('2024年5月4日');
    await i18n.changeLanguage('en');
    expect(formatDate(date)).toBe('May 4, 2024');
    await i18n.changeLanguage('zh-Hans');
    expect(formatDate(date)).toBe('2024年5月4日');
  });

  it('uses the resolved fallback locale and omits missing or invalid dates', async () => {
    await i18n.changeLanguage('fr');
    expect(formatDate('2024-05-04T12:00:00')).toBe('2024年5月4日');
    for (const date of [undefined, null, '', 'invalid']) expect(formatDate(date)).toBe('');
  });

  it.each([false, true])(
    'formats complete search failures with native ListFormat unavailable=%s',
    async (missingListFormat) => {
      if (missingListFormat)
        vi.stubGlobal('Intl', Object.create(Intl, { ListFormat: { value: undefined } }));
      const names = ['NAS A', 'NAS B', '家中 NAS'];
      expect(formatList([])).toBe('');
      expect(formatList(names.slice(0, 1))).toBe('NAS A');
      expect(formatList(names.slice(0, 2))).toBe('NAS A和NAS B');
      expect(formatList(names)).toBe('NAS A、NAS B和家中 NAS');
      expect(t('search.incomplete', { servers: formatList(names) })).toBe(
        '未能完成 NAS A、NAS B和家中 NAS 的搜索',
      );

      await i18n.changeLanguage('en');
      expect(formatList(names.slice(0, 2))).toBe('NAS A and NAS B');
      expect(t('search.incomplete', { servers: formatList(names.slice(0, 1)) })).toBe(
        'Search could not be completed on NAS A.',
      );
      expect(t('search.incomplete', { servers: formatList(names) })).toBe(
        'Search could not be completed on NAS A, NAS B, and 家中 NAS.',
      );
    },
  );
});
