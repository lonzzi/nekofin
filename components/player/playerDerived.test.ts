import type { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  deriveDurationMs,
  deriveEpisodeNavigation,
  deriveExternalAudio,
  deriveExternalSubtitles,
  deriveTracks,
  formatPlayerTitle,
} from './playerDerived';

describe('player derived state', () => {
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

  it('prefers runtime ticks over fallback duration', () => {
    expect(
      deriveDurationMs(
        { id: 'movie-1', name: 'Movie', type: 'Movie', raw: {}, runTimeTicks: 30_000_000 },
        10,
      ),
    ).toBe(3000);
    expect(deriveDurationMs(undefined, 10)).toBe(10);
  });
});
