import { dehydrate, QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  QUERY_CACHE_MAX_BYTES,
  serializeQueryCache,
  serializeQueryCacheAsync,
  shouldPersistQuery,
  utf8Bytes,
} from './queryCachePolicy';

function persisted(client: QueryClient) {
  return { timestamp: Date.now(), buster: 'test', clientState: dehydrate(client) };
}
const key = (id: string) => ['media', 'server', 'account', 'item-detail', id, 'user'];

it('counts UTF-8 storage bytes like the platform encoder, including surrogate pairs and malformed strings', () => {
  for (const text of [
    '',
    'plain ASCII',
    'éø',
    '字幕日本語',
    '😀𐀀',
    'a😀中é',
    '\ud800',
    '\udc00',
    '\ud800x',
    'x\udc00',
    '\ud800\ud800\udc00',
    '中😀aé'.repeat(1000),
  ]) {
    expect(utf8Bytes(text)).toBe(new TextEncoder().encode(text).length);
  }
});

describe('bounded catalog persistence', () => {
  it('persists catalog fields needed by artwork without storing playback sessions, signed URLs or comments', () => {
    const client = new QueryClient();
    const item = {
      id: 'movie',
      name: 'Movie $&',
      raw: {
        ImageTags: { Primary: 'tag' },
        MediaSources: [{ DirectStreamUrl: 'https://test/?api_key=secret' }],
        AccessToken: 'secret',
        UserData: { Played: true },
      },
      nested: { url: 'https://test/image?api_key=secret', authorization: 'secret' },
    };
    client.setQueryData(key('movie'), item);
    client.setQueryData(['media', 'server', 'account', 'stream-info', 'movie'], {
      sessionId: 'session',
      url: 'secret',
    });
    client.setQueryData(['media', 'server', 'account', 'comments', 'movie'], {
      comments: ['large comment payload'],
    });
    client.setQueryData(['media', 'server', 'account', 'media-sources', 'movie'], {
      signed: 'secret',
    });
    const restored = JSON.parse(serializeQueryCache(persisted(client)));
    expect(restored.clientState.queries).toHaveLength(1);
    expect(restored.clientState.queries[0].state.data).toMatchObject({
      name: 'Movie $&',
      raw: { ImageTags: { Primary: 'tag' } },
    });
    expect(JSON.stringify(restored)).not.toContain('secret');
    expect(client.getQueryData(key('movie'))).toBe(item);
    expect(shouldPersistQuery(client.getQueryCache().find({ queryKey: key('movie') })!)).toBe(true);
    client.clear();
  });

  it('keeps only recent entries, bounds the query count, and discards old catalog data', () => {
    const client = new QueryClient();
    client.setQueryData(
      key('expired'),
      { id: 'expired' },
      { updatedAt: Date.now() - 25 * 60 * 60 * 1000 },
    );
    for (let index = 0; index < 80; index++)
      client.setQueryData(key(String(index)), { index }, { updatedAt: Date.now() - 80 + index });
    const restored = JSON.parse(serializeQueryCache(persisted(client)));
    expect(restored.clientState.queries).toHaveLength(64);
    expect(restored.clientState.queries[0].state.data.index).toBe(79);
    expect(
      restored.clientState.queries.some((query: { queryKey: string[] }) =>
        query.queryKey.includes('expired'),
      ),
    ).toBe(false);
    client.clear();
  });

  it('bounds UTF-8 disk usage and skips oversized individual results', () => {
    const client = new QueryClient();
    for (let index = 0; index < 60; index++)
      client.setQueryData(key(String(index)), { name: '中'.repeat(50000) });
    client.setQueryData(key('huge'), { name: '中'.repeat(200000) });
    const encoded = serializeQueryCache(persisted(client));
    expect(utf8Bytes(encoded)).toBe(new TextEncoder().encode(encoded).length);
    expect(utf8Bytes(encoded)).toBeLessThanOrEqual(QUERY_CACHE_MAX_BYTES);
    expect(JSON.parse(encoded).clientState.queries.length).toBeGreaterThan(0);
    expect(encoded).not.toContain('huge');
    expect(utf8Bytes('字幕😀')).toBe(10);
    client.clear();
  });

  it('persists only the first two pagination pages without truncating the live list', () => {
    const client = new QueryClient();
    const queryKey = ['media', 'server', 'account', 'folder-items', 'folder', {}];
    const data = {
      pages: [{ items: ['one'] }, { items: ['two'] }, { items: ['three'] }],
      pageParams: [0, 60, 120],
    };
    client.setQueryData(queryKey, data);
    const restored = JSON.parse(serializeQueryCache(persisted(client)));
    expect(restored.clientState.queries[0].state.data).toEqual({
      pages: data.pages.slice(0, 2),
      pageParams: [0, 60],
    });
    expect(client.getQueryData(queryKey)).toEqual(data);
    client.clear();
  });
});

it('serializes the same sanitized cache in idle slices, including oversized entries', async () => {
  const client = new QueryClient();
  client.setQueryData(key('one'), { name: '字幕', raw: { accessToken: 'secret' } });
  client.setQueryData(key('huge'), { name: '中'.repeat(200000) });
  client.setQueryData(key('two'), { name: 'two' });
  const cache = persisted(client);
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => (now += 8));
  let resume!: () => void;
  const yieldControl = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
  );
  const result = serializeQueryCacheAsync(cache, yieldControl);
  expect(yieldControl).toHaveBeenCalledOnce();
  for (let turn = 0; turn < 4; turn++) {
    resume();
    await Promise.resolve();
  }
  const encoded = await result;
  expect(encoded).toBe(serializeQueryCache(cache));
  expect(encoded).not.toContain('secret');
  expect(encoded).not.toContain('huge');
  expect(yieldControl).toHaveBeenCalledTimes(4);
  clock.mockRestore();
  client.clear();
});
