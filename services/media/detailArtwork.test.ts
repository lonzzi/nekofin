import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  detailArtworkQueryOptions,
  getDetailArtwork,
  rememberDetailArtwork,
} from './detailArtwork';
import { mediaQueryKeys } from './queryKeys';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

const server = { id: 'one', userId: 'alice' } as MediaServerInfo;
const episode: MediaItem = { id: 'episode', name: 'Episode', type: 'Episode', raw: {} };
const adapter = {
  getImageInfo: vi.fn(({ item, opts }) => ({
    url: `${item.id}/${opts.preferBackdrop ? 'backdrop' : 'still'}/${opts.width}`,
    blurhash: opts.preferBackdrop ? 'series-hash' : 'episode-hash',
  })),
} as unknown as MediaAdapter;

describe('detail artwork handoff', () => {
  it('provides artwork and title synchronously while leaving real detail queries pending', () => {
    const client = new QueryClient();
    rememberDetailArtwork({ client, server, adapter, item: episode, targetItemId: episode.id });
    const observer = new QueryObserver(client, detailArtworkQueryOptions(server, episode.id));
    const unsubscribe = observer.subscribe(() => {});
    try {
      expect(observer.getCurrentResult().data?.header.url).toBe('episode/still/1000');
      expect(observer.getCurrentResult().data?.title).toBe('Episode');
      expect(observer.getCurrentResult().fetchStatus).toBe('idle');
      expect(
        client.getQueryData(mediaQueryKeys.detailBundle(server.id, 'episode', episode.id)),
      ).toBeUndefined();
      expect(
        client.getQueryData(mediaQueryKeys.itemDetail(server.id, episode.id, server.userId)),
      ).toBeUndefined();
      expect(client.getQueryCache().getAll()).toHaveLength(1);
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('isolates the same item ID across servers and signed-in users', () => {
    const client = new QueryClient();
    try {
      rememberDetailArtwork({ client, server, adapter, item: episode, targetItemId: episode.id });
      for (const other of [
        { ...server, id: 'two' },
        { ...server, userId: 'bob' },
      ]) {
        expect(
          client.getQueryData(detailArtworkQueryOptions(other, episode.id).queryKey),
        ).toBeUndefined();
      }
    } finally {
      client.clear();
    }
  });

  it('does not reuse an episode still when a card opens its parent series', () => {
    const client = new QueryClient();
    try {
      rememberDetailArtwork({ client, server, adapter, item: episode, targetItemId: 'series' });
      rememberDetailArtwork({
        client,
        server: null,
        adapter,
        item: episode,
        targetItemId: episode.id,
      });
      expect(client.getQueryCache().getAll()).toHaveLength(0);
    } finally {
      client.clear();
    }
  });

  it('keeps the initial and selected episode artwork on the same image and blurhash', () => {
    const artwork = getDetailArtwork(adapter, episode);
    expect(artwork.atmosphere).toBe(artwork.header);
    expect(artwork.header.blurhash).toBe('episode-hash');
    const next = getDetailArtwork(adapter, { ...episode, id: 'next' });
    expect(next.atmosphere.url).toBe('next/still/1000');
    const movie = getDetailArtwork(adapter, { ...episode, type: 'Movie' });
    expect(movie.atmosphere.url).toBe('episode/backdrop/640');
  });
});
