import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { homeCarouselLibraryIds, visibleHomeLibraryIds } from './homeVisibility';
import { homeRandomQueryOptions } from './queryOptions';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

const server = { id: 'account', userId: 'user' } as MediaServerInfo;
const item = (id: string, parentId = 'nested-folder'): MediaItem => ({
  id,
  parentId,
  name: id,
  type: 'Movie',
  raw: {},
});
const adapterWith = (
  getRandomItems: MediaAdapter['getRandomItems'] = vi.fn(async () => [item('movie')]),
) => ({ getRandomItems }) as unknown as MediaAdapter;

describe('home carousel library visibility', () => {
  it('uses all visible libraries by default, including newly added libraries', () => {
    const libraries = [item('movies'), item('anime'), item('hidden')];
    expect(homeCarouselLibraryIds(libraries, ['hidden'])).toEqual(['anime', 'movies']);
    expect(homeCarouselLibraryIds([...libraries, item('new')], ['hidden'])).toEqual([
      'anime',
      'movies',
      'new',
    ]);
  });

  it('only requests custom choices that are still available and visible', async () => {
    const libraries = [item('movies'), item('anime'), item('hidden'), item('new')];
    const adapter = adapterWith();
    const libraryIds = homeCarouselLibraryIds(
      libraries,
      ['hidden'],
      ['anime', 'hidden', 'deleted'],
    );
    expect(libraryIds).toEqual(['anime']);
    await homeRandomQueryOptions({ adapter, currentServer: server, libraryIds }).queryFn!(
      {} as never,
    );
    expect(adapter.getRandomItems).toHaveBeenCalledExactlyOnceWith({
      userId: 'user',
      folderId: 'anime',
      limit: 6,
    });
    // Other home sections continue using all visible libraries.
    expect(visibleHomeLibraryIds(libraries, ['hidden'])).toEqual(['anime', 'movies', 'new']);
  });

  it.each([{ selectedIds: [] }, { selectedIds: ['deleted'] }, { selectedIds: ['hidden'] }])(
    'does not widen an empty or unavailable custom range: $selectedIds',
    async ({ selectedIds }) => {
      const adapter = adapterWith();
      const libraryIds = homeCarouselLibraryIds(
        [item('movies'), item('hidden')],
        ['hidden'],
        selectedIds,
      );
      const options = homeRandomQueryOptions({ adapter, currentServer: server, libraryIds });
      expect(options.enabled).toBe(false);
      await expect(options.queryFn!({} as never)).resolves.toEqual([]);
      expect(adapter.getRandomItems).not.toHaveBeenCalled();
    },
  );

  it('only requests selected libraries, including their nested folders', async () => {
    const getRandomItems = vi.fn(async ({ folderId }: { folderId?: string }) => [item(folderId!)]);
    const options = homeRandomQueryOptions({
      adapter: adapterWith(getRandomItems),
      currentServer: server,
      libraryIds: ['movies', 'anime'],
    });
    const items = await options.queryFn!({} as never);
    expect(items.map((entry) => entry.id).sort()).toEqual(['anime', 'movies']);
    expect(items.every((entry) => entry.parentId === 'nested-folder')).toBe(true);
    expect(getRandomItems.mock.calls.map(([params]) => params.folderId).sort()).toEqual([
      'anime',
      'movies',
    ]);
    expect(getRandomItems).toHaveBeenCalledWith({ userId: 'user', folderId: 'movies', limit: 6 });
  });

  it('returns nothing while libraries are unavailable or all are disabled, even on manual refresh', async () => {
    const adapter = adapterWith();
    const options = homeRandomQueryOptions({ adapter, currentServer: server, libraryIds: [] });
    expect(options.enabled).toBe(false);
    await expect(options.queryFn!({} as never)).resolves.toEqual([]);
    expect(adapter.getRandomItems).not.toHaveBeenCalled();
  });

  it('keeps library order and duplicate IDs from creating different caches or duplicate requests', async () => {
    const adapter = adapterWith();
    const a = homeRandomQueryOptions({
      adapter,
      currentServer: server,
      libraryIds: ['b', 'a', 'a'],
    });
    const b = homeRandomQueryOptions({ adapter, currentServer: server, libraryIds: ['a', 'b'] });
    expect(a.queryKey).toEqual(b.queryKey);
    await a.queryFn!({} as never);
    expect(adapter.getRandomItems).toHaveBeenCalledTimes(2);
  });

  it('does not reuse the previous unfiltered or differently selected carousel cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = homeRandomQueryOptions({
      adapter: adapterWith(),
      currentServer: server,
      libraryIds: ['safe'],
    });
    client.setQueryData(
      ['media', 'server', 'account', 'home', 'random'],
      [item('hidden-old-cache')],
    );
    const previous = homeRandomQueryOptions({
      adapter: adapterWith(),
      currentServer: server,
      libraryIds: ['safe', 'hidden'],
    });
    client.setQueryData(previous.queryKey, [item('hidden-scoped-cache')]);
    const observer = new QueryObserver(client, options);
    expect(observer.getCurrentResult().data).toBeUndefined();
    client.clear();
  });

  it('does not display an old in-flight result after a library is disabled', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolve!: (items: MediaItem[]) => void;
    const adapter = adapterWith(
      vi.fn(
        () =>
          new Promise<MediaItem[]>((done) => {
            resolve = done;
          }),
      ),
    );
    const options = homeRandomQueryOptions({
      adapter,
      currentServer: server,
      libraryIds: ['hidden'],
    });
    const pending = client.fetchQuery(options);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    observer.setOptions(homeRandomQueryOptions({ adapter, currentServer: server, libraryIds: [] }));
    resolve([item('hidden-movie')]);
    await pending;
    expect(observer.getCurrentResult().data).toBeUndefined();
    unsubscribe();
    client.clear();
  });

  it('keeps identical library IDs isolated between server accounts', () => {
    const adapter = adapterWith();
    const a = homeRandomQueryOptions({ adapter, currentServer: server, libraryIds: ['library'] });
    const b = homeRandomQueryOptions({
      adapter,
      currentServer: { ...server, id: 'other-account' },
      libraryIds: ['library'],
    });
    expect(a.queryKey).not.toEqual(b.queryKey);
  });

  it('deduplicates overlapping libraries and caps the carousel at six items', async () => {
    const adapter = adapterWith(
      vi.fn(async () => Array.from({ length: 6 }, (_, index) => item(`movie-${index}`))),
    );
    const options = homeRandomQueryOptions({
      adapter,
      currentServer: server,
      libraryIds: ['a', 'b'],
    });
    const items = await options.queryFn!({} as never);
    expect(items).toHaveLength(6);
    expect(new Set(items.map((entry) => entry.id)).size).toBe(6);
  });

  it('does not fall back to all libraries when a selected library request fails', async () => {
    const adapter = adapterWith(
      vi.fn(async () => {
        throw new Error('unavailable');
      }),
    );
    const options = homeRandomQueryOptions({
      adapter,
      currentServer: server,
      libraryIds: ['safe'],
    });
    await expect(options.queryFn!({} as never)).rejects.toThrow('unavailable');
    expect(adapter.getRandomItems).toHaveBeenCalledTimes(1);
    expect(adapter.getRandomItems).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'safe' }),
    );
  });
});
