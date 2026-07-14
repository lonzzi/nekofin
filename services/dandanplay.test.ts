import { describe, expect, it } from 'vitest';

import { selectDandanEpisode, type DandanAnime } from './dandanplay';

const animes: DandanAnime[] = [
  {
    animeId: 1,
    animeTitle: '第一季',
    type: 'tvseries',
    typeDescription: 'TV动画',
    episodes: [
      { episodeId: 101, episodeTitle: '第1话' },
      { episodeId: 102, episodeTitle: '第2话' },
    ],
  },
];

describe('selectDandanEpisode', () => {
  it('selects an episode using one-based season and episode numbers', () => {
    expect(selectDandanEpisode(animes, 1, 2)).toEqual({
      anime: animes[0],
      episode: animes[0].episodes[1],
    });
  });

  it.each([
    ['missing episode number', 1, undefined],
    ['zero season number', 0, 1],
    ['season out of range', 2, 1],
    ['episode out of range', 1, 3],
  ])('returns undefined for %s', (_case, seasonNumber, episodeNumber) => {
    expect(selectDandanEpisode(animes, seasonNumber, episodeNumber)).toBeUndefined();
  });
});
