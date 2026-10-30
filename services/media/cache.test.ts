import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { invalidatePlaybackWatchState, updateCachedMediaItemUserData } from './cache';
import { mediaQueryKeys } from './queryKeys';
import type { MediaItem } from './types';

const mediaItem: MediaItem = {
  id: 'item-1',
  name: 'Item One',
  type: 'Movie' as const,
  raw: { Id: 'item-1' },
  userData: {
    played: false,
    isFavorite: false,
  },
};

describe('updateCachedMediaItemUserData', () => {
  it('updates matching media items in arrays', () => {
    const data = [mediaItem, { ...mediaItem, id: 'item-2' }];

    const next = updateCachedMediaItemUserData(data, 'item-1', (current) => ({
      ...current,
      isFavorite: true,
    }));

    expect(next[0].userData?.isFavorite).toBe(true);
    expect(next[1].userData?.isFavorite).toBe(false);
    expect(next).not.toBe(data);
  });

  it('updates nested detail bundles and infinite query pages', () => {
    const data = {
      pages: [
        {
          items: [mediaItem],
          total: 1,
        },
      ],
      pageParams: [0],
      detail: {
        item: mediaItem,
      },
    };

    const next = updateCachedMediaItemUserData(data, 'item-1', (current) => ({
      ...current,
      played: true,
      playedPercentage: 100,
    }));

    expect(next.pages[0].items[0].userData?.played).toBe(true);
    expect(next.detail.item.userData?.playedPercentage).toBe(100);
  });

  it('keeps the same reference when no item matches', () => {
    const data = [mediaItem];

    const next = updateCachedMediaItemUserData(data, 'missing', (current) => ({
      ...current,
      isFavorite: true,
    }));

    expect(next).toBe(data);
  });
});

describe('playback watched state refresh', () => {
  it('invalidates the played server and its aggregate search without replacing a playback session', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const changedKeys = [
      mediaQueryKeys.homeLatest('server-1', 'anime'),
      mediaQueryKeys.folderItems('server-1', 'anime', {}),
      mediaQueryKeys.viewAll('server-1', 'latest', 'anime', {}),
      mediaQueryKeys.favorites('server-1', {}),
      mediaQueryKeys.detailBundle('server-1', 'series', 'series-1'),
      mediaQueryKeys.itemDetail('server-1', 'episode-1', 'user-1'),
      mediaQueryKeys.episodes('server-1', 'season-1', 'user-1'),
      mediaQueryKeys.firstEpisodeBySeason('server-1', 'season-1', 'user-1'),
      mediaQueryKeys.searchItems('server-1', 'Neko'),
      mediaQueryKeys.aggregateSearchItems(['server-1', 'server-2'], 'Neko'),
    ];
    const unchangedKeys = [
      mediaQueryKeys.homeLatest('server-2', 'anime'),
      mediaQueryKeys.aggregateSearchItems(['server-2'], 'Neko'),
      mediaQueryKeys.detailArtwork('server-1', 'user-1', 'series-1'),
      mediaQueryKeys.mediaSources('server-1', 'episode-1', 'user-1'),
      mediaQueryKeys.streamInfo('server-1', 'episode-1', 'user-1', {
        enableTranscoding: false,
        maxBitrate: 0,
        enableSubtitleBurnIn: false,
        selectedCodec: 'auto',
      }),
    ];
    try {
      for (const key of [...changedKeys, ...unchangedKeys]) client.setQueryData(key, [mediaItem]);
      await invalidatePlaybackWatchState(client, 'server-1');
      for (const key of changedKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      for (const key of unchangedKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    } finally {
      client.clear();
    }
  });

  it('refreshes visible posters while leaving the playing item resume position untouched', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const posterKey = mediaQueryKeys.homeLatest('server-1', 'anime');
    const playingKey = mediaQueryKeys.itemDetail('server-1', 'episode-1', 'user-1');
    const initialItem = { ...mediaItem, id: 'episode-1', userData: { playbackPositionTicks: 123 } };
    client.setQueryData(posterKey, [mediaItem]);
    client.setQueryData(playingKey, initialItem);
    let playbackFetches = 0;
    const posterObserver = new QueryObserver(client, {
      queryKey: posterKey,
      queryFn: async () => [{ ...mediaItem, userData: { played: true } }],
    });
    const playingObserver = new QueryObserver(client, {
      queryKey: playingKey,
      queryFn: async () => {
        playbackFetches++;
        return { ...initialItem, userData: { playbackPositionTicks: 0 } };
      },
    });
    const unsubscribePoster = posterObserver.subscribe(() => {});
    const unsubscribePlaying = playingObserver.subscribe(() => {});
    try {
      await invalidatePlaybackWatchState(client, 'server-1');
      expect(client.getQueryData<MediaItem[]>(posterKey)?.[0].userData?.played).toBe(true);
      expect(playbackFetches).toBe(0);
      expect(client.getQueryData(playingKey)).toBe(initialItem);
      expect(client.getQueryState(playingKey)?.isInvalidated).toBe(true);
    } finally {
      unsubscribePoster();
      unsubscribePlaying();
      client.clear();
    }
  });
});
