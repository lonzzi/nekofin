import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { fetchVisibleHomePage, nextVisibleHomePage, visibleHomeLibraryIds } from './homeVisibility';
import {
  homeNextUpQueryOptions,
  homeResumeQueryOptions,
  viewAllQueryOptions,
} from './queryOptions';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

const server = { id: 'account', userId: 'user' } as MediaServerInfo;
const item = (id: string, parentId?: string): MediaItem => ({
  id,
  name: id,
  type: 'Movie',
  parentId,
  raw: {},
});
const scope = () => ({ queryClient: new QueryClient(), libraryIds: ['visible'] });
const adapter = (overrides: Partial<MediaAdapter> = {}) =>
  ({
    getItemAncestors: vi.fn(async ({ itemId }: { itemId: string }) => [
      item(itemId.startsWith('hidden') ? 'hidden' : 'visible'),
    ]),
    getResumeItems: vi.fn(async () => ({ items: [item('movie')] })),
    getNextUpItems: vi.fn(async () => ({ items: [item('episode')] })),
    getLatestItemsByFolder: vi.fn(async () => ({ items: [item('latest')] })),
    ...overrides,
  }) as unknown as MediaAdapter;

describe('all home surfaces respect library visibility', () => {
  it('builds a stable allowlist only from returned, enabled libraries', () => {
    expect(
      visibleHomeLibraryIds([item('b'), item('hidden'), item('a'), item('b')], ['hidden']),
    ).toEqual(['a', 'b']);
    expect(visibleHomeLibraryIds(undefined)).toEqual([]);
  });

  it('checks full ancestry for nested movies and episodes without reordering them', async () => {
    const media = adapter();
    const fetchPage = vi.fn(async () => ({
      items: [item('hidden-movie'), { ...item('episode'), seriesId: 'series' }, item('movie')],
    }));
    const result = await fetchVisibleHomePage({
      adapter: media,
      server,
      scope: scope(),
      fetchPage,
      limit: 10,
    });
    expect(result.items.map((value) => value.id)).toEqual(['episode', 'movie']);
    expect(media.getItemAncestors).toHaveBeenCalledWith({ userId: 'user', itemId: 'series' });
  });

  it('accepts known visible direct parents without extra ancestry requests', async () => {
    const media = adapter();
    const result = await fetchVisibleHomePage({
      adapter: media,
      server,
      scope: scope(),
      limit: 10,
      fetchPage: async () => ({ items: [item('movie', 'visible')] }),
    });
    expect(result.items).toHaveLength(1);
    expect(media.getItemAncestors).not.toHaveBeenCalled();
  });

  it('refills filtered pages and returns the raw cursor without skipping later visible items', async () => {
    const raw = [
      item('hidden-a'),
      item('hidden-b'),
      item('a'),
      item('hidden-c'),
      item('b'),
      item('c'),
    ];
    const fetchPage = vi.fn(async (start: number, limit: number) => ({
      items: raw.slice(start, start + limit),
      total: raw.length,
    }));
    const context = { adapter: adapter(), server, scope: scope(), fetchPage, limit: 2 };
    const first = await fetchVisibleHomePage(context);
    expect(first.items.map((value) => value.id)).toEqual(['a', 'b']);
    expect(first.nextStartIndex).toBe(5);
    const second = await fetchVisibleHomePage({ ...context, startIndex: first.nextStartIndex });
    expect(second.items.map((value) => value.id)).toEqual(['c']);
    expect(second.nextStartIndex).toBeUndefined();
  });

  it('shares concurrent series ancestry lookups across resume and next-up', async () => {
    const media = adapter();
    const sharedScope = scope();
    const fetchPage = async () => ({
      items: [
        { ...item('episode-1'), seriesId: 'series' },
        { ...item('episode-2'), seriesId: 'series' },
      ],
    });
    await Promise.all(
      [1, 2].map(() =>
        fetchVisibleHomePage({ adapter: media, server, scope: sharedScope, fetchPage, limit: 10 }),
      ),
    );
    expect(media.getItemAncestors).toHaveBeenCalledTimes(1);
  });

  it('does not fetch any watch history or ancestry with no enabled library', async () => {
    const media = adapter();
    const fetchPage = vi.fn();
    expect(
      await fetchVisibleHomePage({
        adapter: media,
        server,
        scope: { ...scope(), libraryIds: [] },
        fetchPage,
        limit: 10,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(fetchPage).not.toHaveBeenCalled();
    expect(media.getItemAncestors).not.toHaveBeenCalled();
  });

  it('never treats missing or failed ancestry as proof an item is visible', async () => {
    const common = {
      server,
      scope: scope(),
      limit: 10,
      fetchPage: async () => ({ items: [item('movie')] }),
    };
    const empty = await fetchVisibleHomePage({
      ...common,
      adapter: adapter({ getItemAncestors: vi.fn(async () => []) }),
    });
    expect(empty.items).toEqual([]);
    await expect(
      fetchVisibleHomePage({
        ...common,
        scope: scope(),
        adapter: adapter({
          getItemAncestors: vi.fn(async () => {
            throw new Error('offline');
          }),
        }),
      }),
    ).rejects.toThrow('offline');
  });

  it('stops providers that repeat the same raw page or ignore pagination', async () => {
    const fetchPage = vi.fn(async () => ({ items: [item('hidden-a'), item('hidden-b')] }));
    const result = await fetchVisibleHomePage({
      adapter: adapter(),
      server,
      scope: scope(),
      fetchPage,
      limit: 2,
    });
    expect(result.items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    const repeated = { items: [item('a')], total: 1, nextStartIndex: 2 };
    expect(nextVisibleHomePage(repeated, [repeated, repeated])).toBeUndefined();
  });

  it('stops obsolete requests before reading another page after a visibility change', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = vi.fn();
    await expect(
      fetchVisibleHomePage({
        adapter: adapter(),
        server,
        scope: scope(),
        fetchPage,
        limit: 10,
        signal: controller.signal,
      }),
    ).rejects.toThrow('cancelled');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it.each([homeResumeQueryOptions, homeNextUpQueryOptions])(
    'isolates watch-row caches from old/unfiltered and other accounts',
    (optionsFor) => {
      const sharedScope = scope();
      const media = adapter();
      const options = optionsFor({ adapter: media, currentServer: server, ...sharedScope });
      sharedScope.queryClient.setQueryData(options.queryKey.slice(0, -1), [item('hidden-cache')]);
      sharedScope.queryClient.setQueryData(
        optionsFor({
          adapter: media,
          currentServer: server,
          ...sharedScope,
          libraryIds: ['visible', 'hidden'],
        }).queryKey,
        [item('hidden-cache')],
      );
      expect(
        new QueryObserver(sharedScope.queryClient, options).getCurrentResult().data,
      ).toBeUndefined();
      expect(options.queryKey).not.toEqual(
        optionsFor({ adapter: media, currentServer: { ...server, id: 'other' }, ...sharedScope })
          .queryKey,
      );
      sharedScope.queryClient.clear();
    },
  );

  it.each(['resume', 'nextup', 'latest'])(
    'gates the %s view-all route when its libraries are closed',
    async (type) => {
      const media = adapter();
      const options = viewAllQueryOptions({
        adapter: media,
        currentServer: server,
        ...scope(),
        libraryIds: [],
        type,
        folderId: 'visible',
        filters: {},
      });
      expect(options.enabled).toBe(false);
      expect(await options.queryFn!({ pageParam: 0 } as never)).toEqual({ items: [], total: 0 });
      expect(media.getResumeItems).not.toHaveBeenCalled();
      expect(media.getNextUpItems).not.toHaveBeenCalled();
      expect(media.getLatestItemsByFolder).not.toHaveBeenCalled();
    },
  );

  it('does not load a closed latest folder from a saved route while another library is visible', async () => {
    const media = adapter();
    const options = viewAllQueryOptions({
      adapter: media,
      currentServer: server,
      ...scope(),
      type: 'latest',
      folderId: 'hidden',
      filters: {},
    });
    expect(options.enabled).toBe(false);
    expect(await options.queryFn!({ pageParam: 0 } as never)).toEqual({ items: [], total: 0 });
    expect(media.getLatestItemsByFolder).not.toHaveBeenCalled();
  });
});
