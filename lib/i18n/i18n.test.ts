import { navigationDestinations } from '@/components/navigation/navigationDestinations';
import { derivePlaybackMenuActions } from '@/components/player/playerMenuModel';
import { buildConnectionAddress } from '@/lib/serverConnection';
import { afterEach, describe, expect, it } from 'vitest';

import { i18n, resources, t } from './index';

afterEach(() => i18n.changeLanguage('zh-Hans'));

const placeholders = (value: string) =>
  [...value.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) => match[1]).sort();

describe('bundled translations', () => {
  it('ships the same messages and interpolation parameters in both languages', () => {
    const chinese = resources['zh-Hans'].translation;
    const english = resources.en.translation;
    expect(Object.keys(english).sort()).toEqual(Object.keys(chinese).sort());
    for (const key of Object.keys(chinese) as (keyof typeof chinese)[]) {
      expect(english[key].trim(), key).not.toBe('');
      expect(placeholders(english[key]), key).toEqual(placeholders(chinese[key]));
      expect(key).toMatch(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/);
      if (key !== 'settings.languageSimplifiedChinese')
        expect(english[key], key).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it('translates live navigation labels, native menu models, and service errors', async () => {
    expect(navigationDestinations[0].title).toBe('首页');
    await i18n.changeLanguage('en');
    expect(navigationDestinations[0].title).toBe('Home');
    expect(derivePlaybackMenuActions(1, 'fit')[0].title).toContain('Playback speed');
    expect(() => buildConnectionAddress('')).toThrow('Enter a server URL');
    await i18n.changeLanguage('zh-Hans');
    expect(navigationDestinations[0].title).toBe('首页');
    expect(() => buildConnectionAddress('')).toThrow('请输入服务器地址');
  });

  it('preserves user-provided names while translating surrounding messages', async () => {
    await i18n.changeLanguage('en');
    expect(t('common.deleteNamedConfirmation', { name: '家中 NAS <Media>' })).toBe(
      'Delete “家中 NAS <Media>”?',
    );
    expect(t('server.serverAndAccountCounts', { count: 1, count2: 2 })).toBe(
      'Servers: 1 · Accounts: 2',
    );
  });

  it('keeps the English episode count value separate from its row label', async () => {
    await i18n.changeLanguage('en');
    for (const value of [1, 24, 100]) {
      expect(`${t('player.episodes')} ${t('media.episodeCount', { value })}`).toBe(
        `Episodes ${value}`,
      );
    }
  });
});
