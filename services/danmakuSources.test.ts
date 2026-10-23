import { i18n } from '@/lib/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import {
  danmakuEndpointUrl,
  danmakuSourcesKey,
  getDanmakuSources,
  normalizeDanmakuApiUrl,
  parseDanmakuSourceSettings,
} from './danmakuSources';

afterEach(() => i18n.changeLanguage('zh-Hans'));

describe('danmaku API configuration', () => {
  it('updates the built-in name without invalidating cached comments on language changes', async () => {
    const settings = parseDanmakuSourceSettings(
      JSON.stringify({
        customSources: [
          { id: 'custom', name: '家中 API', baseUrl: 'https://example.test', enabled: true },
        ],
      }),
    );
    const sources = getDanmakuSources(settings);
    const key = danmakuSourcesKey(sources);
    expect(sources[0].name).toBe('默认 API');
    await i18n.changeLanguage('en');
    expect(sources[0].name).toBe('Default API');
    expect(sources[1].name).toBe('家中 API');
    expect(danmakuSourcesKey(sources)).toBe(key);
    expect(danmakuSourcesKey(getDanmakuSources(settings))).toBe(key);
  });

  it('keeps token prefixes and auth parameters intact when appending endpoints', () => {
    expect(
      danmakuEndpointUrl(
        'http://example.test:7768/api/v1/private-token/',
        '/comment/123',
      ).toString(),
    ).toBe('http://example.test:7768/api/v1/private-token/comment/123');
    expect(
      danmakuEndpointUrl(
        'https://example.test/api/v2?key=private',
        '/search/episodes',
      ).searchParams.get('key'),
    ).toBe('private');
    expect(normalizeDanmakuApiUrl(' https://example.test/ ')).toBe('https://example.test/api/v2');
  });
  it.each(['', 'ftp://example.test', 'not a url', 'https://user:password@example.test'])(
    'rejects unusable address %s',
    (value) => {
      expect(() => normalizeDanmakuApiUrl(value)).toThrow();
    },
  );
  it('migrates missing settings without disclosing the built-in URL as a label', () => {
    const sources = getDanmakuSources(parseDanmakuSourceSettings());
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('默认 API');
    expect(sources[0].enabled).toBe(true);
  });
  it('recovers valid entries from damaged saved settings and respects all APIs disabled', () => {
    const settings = parseDanmakuSourceSettings(
      JSON.stringify({
        defaultEnabled: false,
        mode: 'merge',
        customSources: [
          { id: 'a', name: ' 自建 ', baseUrl: 'http://example.test', enabled: false },
          { id: 'a', name: 'duplicate', baseUrl: 'https://other.test' },
          { id: 'b', name: 'same endpoint', baseUrl: 'http://example.test/api/v2' },
          { id: 'c', name: 'bad', baseUrl: 'broken' },
          null,
        ],
      }),
    );
    expect(settings.customSources).toEqual([
      { id: 'a', name: '自建', baseUrl: 'http://example.test/api/v2', enabled: false },
    ]);
    expect(settings.mode).toBe('merge');
    expect(getDanmakuSources(settings).some((source) => source.enabled)).toBe(false);
  });
  it('isolates caches after edits without placing tokens in query keys', () => {
    const source = {
      id: 'a',
      name: 'API',
      baseUrl: 'https://example.test/api/v1/private-token',
      enabled: true,
    };
    expect(danmakuSourcesKey([source])).not.toContain('private-token');
    expect(danmakuSourcesKey([source])).not.toBe(
      danmakuSourcesKey([{ ...source, baseUrl: source.baseUrl + '2' }]),
    );
    expect(danmakuSourcesKey([source])).not.toBe(
      danmakuSourcesKey([{ ...source, enabled: false }]),
    );
  });
});
