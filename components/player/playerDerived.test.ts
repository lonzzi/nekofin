import type { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  deriveBufferedProgress,
  deriveDurationMs,
  deriveEpisodeNavigation,
  deriveExternalAudio,
  deriveExternalSubtitles,
  deriveMpvTracks,
  deriveTracks,
  formatPlayerTitle,
} from './playerDerived';

describe('player derived state', () => {
  it('names direct-play tracks from the server while retaining mpv ids, including duplicate languages', () => {
    expect(
      deriveMpvTracks(
        [
          { type: 'audio', id: 1, title: 'File title', lang: 'jpn' },
          { type: 'audio', id: 2, title: 'Another file title', lang: 'jpn' },
          { type: 'sub', id: 1, title: 'File subtitle', lang: 'chi' },
        ],
        [
          { Type: 'Video', Index: 0, DisplayTitle: '1080p' },
          { Type: 'Audio', Index: 2, DisplayTitle: '日语 - AAC - 2.0', Language: 'jpn' },
          { Type: 'Audio', Index: 4, DisplayTitle: '日语 - 评论音轨', Language: 'jpn' },
          { Type: 'Subtitle', Index: 8, DisplayTitle: '简体中文 - ASS', Language: 'chi' },
        ],
      ),
    ).toEqual({
      audio: [
        { index: 1, name: '日语 - AAC - 2.0', language: 'jpn' },
        { index: 2, name: '日语 - 评论音轨', language: 'jpn' },
      ],
      subtitle: [{ index: 1, name: '简体中文 - ASS', language: 'chi' }],
    });
  });

  it('maps external track names by their loaded ids rather than load order', () => {
    const result = deriveMpvTracks(
      [
        { type: 'sub', id: 7, isExternal: true },
        { type: 'sub', id: 3, isExternal: true },
        { type: 'audio', id: 5, isExternal: true },
      ],
      [
        { Type: 'Subtitle', Index: 8, DisplayTitle: '简体中文', IsExternal: true },
        { Type: 'Subtitle', Index: 9, DisplayTitle: '繁體中文', IsExternal: true },
        { Type: 'Audio', Index: 4, DisplayTitle: '评论音轨', DeliveryMethod: 'External' },
      ],
      {
        subtitleIds: new Map([
          [8, 3],
          [9, 7],
        ]),
        audioIds: new Map([[4, 5]]),
      },
    );
    expect(result.subtitle.map(({ index, name }) => ({ index, name }))).toEqual([
      { index: 7, name: '繁體中文' },
      { index: 3, name: '简体中文' },
    ]);
    expect(result.audio[0]).toMatchObject({ index: 5, name: '评论音轨' });
  });

  it('falls back to file metadata and does not assign original stream names to transcoded tracks', () => {
    const native = [{ type: 'audio', id: 1, title: 'File title', lang: 'eng' }];
    const streams = [{ Type: 'Audio', Index: 3, DisplayTitle: '  ' }];
    expect(deriveMpvTracks(native, streams).audio[0].name).toBe('File title [eng]');
    expect(
      deriveMpvTracks(native, [{ ...streams[0], DisplayTitle: 'Other audio' }], {
        isTranscoding: true,
      }).audio[0].name,
    ).toBe('File title [eng]');
    expect(deriveMpvTracks([{ type: 'sub', id: 2 }]).subtitle[0].name).toBe('字幕 2');
    expect(
      deriveTracks([{ Type: 'Audio', Index: 0, DisplayTitle: ' ', Title: 'Commentary' }]).audio[0]
        .name,
    ).toBe('Commentary');
  });

  it('derives audio and subtitle tracks from media streams', () => {
    expect(
      deriveTracks([
        { Type: 'Video', Index: 0, DisplayTitle: '1080p' },
        { Type: 'Audio', Index: 1, DisplayTitle: 'Japanese' },
        { Type: 'Subtitle', Index: 2, Language: 'zh' },
      ]),
    ).toEqual({
      audio: [{ index: 1, name: 'Japanese', language: undefined }],
      subtitle: [{ index: 2, name: 'zh', language: 'zh' }],
    });
  });

  it('derives external subtitle urls', () => {
    expect(
      deriveExternalSubtitles(
        [
          { Type: 'Subtitle', Index: 1, DeliveryMethod: 'External', DeliveryUrl: '/sub.vtt' },
          { Type: 'Subtitle', Index: 2, DeliveryMethod: 'Encode', DeliveryUrl: '/encoded.vtt' },
        ],
        'https://media.test',
      ),
    ).toEqual([{ index: 1, name: '', url: 'https://media.test/sub.vtt' }]);
  });

  it('derives external audio urls', () => {
    expect(
      deriveExternalAudio(
        [
          {
            Type: 'Audio',
            Index: 3,
            DisplayTitle: 'Commentary',
            DeliveryMethod: 'External',
            DeliveryUrl: '/audio.mka',
          },
          { Type: 'Audio', Index: 4, DeliveryMethod: 'Embed', DeliveryUrl: '/embedded.mka' },
          { Type: 'Audio', Index: 5, DeliveryMethod: 'External', DeliveryUrl: null },
        ],
        'https://media.test',
      ),
    ).toEqual([{ index: 3, name: 'Commentary', url: 'https://media.test/audio.mka' }]);
  });

  it('keeps absolute delivery urls and authenticates only the media server', () => {
    const tracks = deriveExternalSubtitles(
      [
        {
          Type: 'Subtitle',
          Index: 1,
          DeliveryMethod: 'External',
          DeliveryUrl: 'https://media.test/jellyfin/sub.srt?format=srt',
        },
        {
          Type: 'Subtitle',
          Index: 2,
          DeliveryMethod: 'External',
          DeliveryUrl: '/jellyfin/sub.ass?api_key=signed',
        },
        {
          Type: 'Subtitle',
          Index: 3,
          DeliveryMethod: 'External',
          DeliveryUrl: 'https://cdn.test/sub.vtt',
        },
        { Type: 'Subtitle', Index: 4, DeliveryMethod: 'External' },
      ],
      'https://media.test/jellyfin',
      { accessToken: 'test-token' },
    );
    expect(tracks.map((track) => track.url)).toEqual([
      'https://media.test/jellyfin/sub.srt?format=srt&api_key=test-token',
      'https://media.test/jellyfin/sub.ass?api_key=signed',
      'https://cdn.test/sub.vtt',
    ]);
  });

  it('builds a subtitle endpoint for external files without a delivery method or url', () => {
    expect(
      deriveExternalSubtitles(
        [
          { Type: 'Subtitle', Index: 5, IsExternal: true, Codec: 'subrip' },
          { Type: 'Subtitle', Index: 6, IsExternal: true, Codec: 'ass', DeliveryMethod: 'Encode' },
        ],
        'https://media.test/emby',
        { itemId: 'movie-1', mediaSourceId: 'version-2', accessToken: 'test-token' },
      ),
    ).toMatchObject([
      {
        index: 5,
        url: 'https://media.test/emby/Videos/movie-1/version-2/Subtitles/5/0/Stream.srt?api_key=test-token',
      },
    ]);
  });

  it('formats episode titles with series and season metadata', () => {
    expect(
      formatPlayerTitle({
        id: 'episode-1',
        name: 'A Beginning',
        type: 'Episode',
        raw: {},
        seriesName: 'Show One',
        parentIndexNumber: 2,
        indexNumber: 3,
      }),
    ).toBe('Show One S2E3 - A Beginning');
  });

  it('derives previous and next episodes', () => {
    const episodes: MediaItem[] = [
      { id: 'episode-1', name: 'One', type: 'Episode', raw: {} },
      { id: 'episode-2', name: 'Two', type: 'Episode', raw: {} },
      { id: 'episode-3', name: 'Three', type: 'Episode', raw: {} },
    ];

    expect(deriveEpisodeNavigation('episode-2', episodes)).toEqual({
      currentIndex: 1,
      previousEpisode: episodes[0],
      nextEpisode: episodes[2],
      hasPreviousEpisode: true,
      hasNextEpisode: true,
    });
  });

  it('prefers runtime ticks and converts the native fallback from seconds', () => {
    expect(
      deriveDurationMs(
        { id: 'movie-1', name: 'Movie', type: 'Movie', raw: {}, runTimeTicks: 30_000_000 },
        10,
      ),
    ).toBe(3000);
    expect(deriveDurationMs(undefined, 10)).toBe(10_000);
  });

  it('derives absolute buffered progress with an Android-compatible fallback', () => {
    expect(
      deriveBufferedProgress({
        positionSeconds: 20,
        durationSeconds: 100,
        bufferedDurationSeconds: 15,
        bufferedPositionSeconds: 65,
      }),
    ).toBe(0.65);
    expect(
      deriveBufferedProgress({
        positionSeconds: 20,
        durationSeconds: 100,
        bufferedDurationSeconds: 15,
      }),
    ).toBe(0.35);
    expect(
      deriveBufferedProgress({
        positionSeconds: 95,
        durationSeconds: 100,
        bufferedDurationSeconds: 20,
      }),
    ).toBe(1);
    expect(
      deriveBufferedProgress({
        positionSeconds: 20,
        durationSeconds: 0,
        bufferedDurationSeconds: 15,
      }),
    ).toBe(0);
  });
});
