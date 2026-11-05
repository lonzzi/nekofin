import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { rememberPlaybackEpisode, type PlaybackEpisode } from './playbackEpisode';
import { mediaQueryKeys } from './queryKeys';
import type { MediaItem, MediaServerInfo } from './types';

const client = new QueryClient();
const server = { id: 'server-a', userId: 'user-a' } as MediaServerInfo;
const episode = (id: string): MediaItem => ({
  id,
  name: id,
  type: 'Episode',
  seriesId: 'series-a',
  seasonId: 'season-a',
  raw: {},
});
const key = mediaQueryKeys.playbackEpisode(server.id, server.userId, 'series-a');
afterEach(() => client.clear());

describe('episode playback handoff', () => {
  it('records the stopped position locally without changing the active player query', () => {
    const item = { ...episode('episode-1'), runTimeTicks: 2_469_120_000 };
    const playerKey = mediaQueryKeys.itemDetail(server.id, item.id, server.userId);
    client.setQueryData(playerKey, item);
    rememberPlaybackEpisode({
      client,
      server,
      item,
      playSessionId: 'session-1',
      positionMs: 0,
      started: true,
    });
    rememberPlaybackEpisode({
      client,
      server,
      item,
      playSessionId: 'session-1',
      positionMs: 123_456,
    });
    expect(client.getQueryData<PlaybackEpisode>(key)?.item.userData?.playbackPositionTicks).toBe(
      1_234_560_000,
    );
    expect(client.getQueryData<PlaybackEpisode>(key)?.item.userData?.playedPercentage).toBe(50);
    expect(client.getQueryData(playerKey)).toBe(item);
  });

  it('keeps the next episode selected when an earlier session stops late', () => {
    const first = episode('episode-1');
    const next = episode('episode-2');
    rememberPlaybackEpisode({
      client,
      server,
      item: first,
      playSessionId: 'session-1',
      positionMs: 0,
      started: true,
    });
    rememberPlaybackEpisode({
      client,
      server,
      item: next,
      playSessionId: 'session-2',
      positionMs: 0,
      started: true,
    });
    rememberPlaybackEpisode({
      client,
      server,
      item: first,
      playSessionId: 'session-1',
      positionMs: 1_440_000,
    });
    expect(client.getQueryData<PlaybackEpisode>(key)?.item.id).toBe(next.id);
  });

  it('isolates the last played episode by server, account, and series', () => {
    const item = episode('episode-1');
    rememberPlaybackEpisode({
      client,
      server,
      item,
      playSessionId: 'session-1',
      positionMs: 0,
      started: true,
    });
    expect(
      client.getQueryData(mediaQueryKeys.playbackEpisode('server-b', server.userId, item.seriesId)),
    ).toBeUndefined();
    expect(
      client.getQueryData(mediaQueryKeys.playbackEpisode(server.id, 'user-b', item.seriesId)),
    ).toBeUndefined();
    expect(
      client.getQueryData(mediaQueryKeys.playbackEpisode(server.id, server.userId, 'series-b')),
    ).toBeUndefined();
  });

  it('does not remember episodes that never started or unrelated movie playback', () => {
    rememberPlaybackEpisode({
      client,
      server,
      item: episode('unstarted'),
      playSessionId: 'session-1',
      positionMs: 0,
    });
    rememberPlaybackEpisode({
      client,
      server,
      item: { ...episode('movie'), type: 'Movie' },
      playSessionId: 'session-2',
      positionMs: 0,
      started: true,
    });
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
