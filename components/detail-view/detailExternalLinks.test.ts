import type { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import { getDetailExternalInfo } from './detailExternalLinks';

const movie: MediaItem = {
  id: 'movie-1',
  name: '星际穿越',
  type: 'Movie',
  productionYear: 2014,
  providerIds: { Tmdb: '157336', Imdb: 'tt0816692' },
  raw: {},
};
const series: MediaItem = {
  id: 'series-1',
  name: '权力的游戏',
  originalTitle: 'Game of Thrones',
  type: 'Series',
  providerIds: { Tmdb: '1399', Imdb: 'tt0944947' },
  raw: {},
};
const episode: MediaItem = {
  id: 'episode-1',
  name: '凛冬将至',
  seriesId: series.id,
  seriesName: series.name,
  type: 'Episode',
  parentIndexNumber: 1,
  indexNumber: 1,
  providerIds: { Tmdb: '63056' },
  raw: {},
};

describe('detail external links', () => {
  it('opens movies and series in their respective TMDB namespaces', () => {
    expect(getDetailExternalInfo(movie).links[0].url).toBe(
      'https://www.themoviedb.org/movie/157336',
    );
    expect(getDetailExternalInfo(series).links[0].url).toBe('https://www.themoviedb.org/tv/1399');
    expect(getDetailExternalInfo(movie).title).toBe('星际穿越 (2014)');
  });

  it('resolves an episode through its series instead of treating its TMDB ID as a show ID', () => {
    const info = getDetailExternalInfo(episode, series);
    expect(info.links[0].url).toBe('https://www.themoviedb.org/tv/1399/season/1/episode/1');
    expect(info.links[1].url).toBe('https://www.imdb.com/title/tt0944947/');
    expect(info.title).toBe('权力的游戏 · S1E1 · 凛冬将至');
  });

  it('uses an episode-specific IMDb ID when available', () => {
    const info = getDetailExternalInfo({ ...episode, providerIds: { Imdb: 'tt1480055' } }, series);
    expect(info.links[1].url).toBe('https://www.imdb.com/title/tt1480055/');
  });

  it('links a season using the parent show ID and supports season zero specials', () => {
    const season: MediaItem = { ...episode, type: 'Season', name: '特别篇', indexNumber: 0 };
    expect(getDetailExternalInfo(season, series).links[0].url).toBe(
      'https://www.themoviedb.org/tv/1399/season/0',
    );
    expect(getDetailExternalInfo({ ...episode, parentIndexNumber: 0 }, series).links[0].url).toBe(
      'https://www.themoviedb.org/tv/1399/season/0/episode/1',
    );
  });

  it('falls back to the series page when episode numbering is missing or invalid', () => {
    expect(
      getDetailExternalInfo({ ...episode, parentIndexNumber: null }, series).links[0].url,
    ).toBe('https://www.themoviedb.org/tv/1399');
    expect(getDetailExternalInfo({ ...episode, indexNumber: -1 }, series).links[0].url).toBe(
      'https://www.themoviedb.org/tv/1399/season/1',
    );
  });

  it('offers encoded title searches when provider IDs are absent', () => {
    const item: MediaItem = { ...movie, name: '你 & 我 / 电影', providerIds: null };
    const info = getDetailExternalInfo(item);
    expect(info.links.every((link) => !link.isDirect)).toBe(true);
    expect(new URL(info.links[0].url).searchParams.get('query')).toBe(item.name);
    expect(new URL(info.links[1].url).searchParams.get('q')).toBe(item.name);
    expect(info.links.map((link) => link.label)).toEqual(['在 TMDB 搜索', '在 IMDb 搜索']);
    expect(new URL(getDetailExternalInfo(episode).links[0].url).searchParams.get('query')).toBe(
      series.name,
    );
  });

  it('normalizes provider key casing and rejects malformed IDs', () => {
    const info = getDetailExternalInfo({
      ...movie,
      providerIds: { TMDB: ' 157336 ', IMDB: ' TT0816692 ' },
    });
    expect(info.links[0].isDirect).toBe(true);
    expect(info.links[1].url).toBe('https://www.imdb.com/title/tt0816692/');
    const invalid = getDetailExternalInfo({
      ...movie,
      providerIds: { Tmdb: '../wrong', Imdb: 'https://server.example/private' },
    });
    expect(invalid.links.every((link) => !link.isDirect)).toBe(true);
  });

  it('prefers an existing public title page over a search result for sharing', () => {
    expect(getDetailExternalInfo(movie).shareUrl).toBe('https://www.themoviedb.org/movie/157336');
    expect(getDetailExternalInfo({ ...movie, providerIds: { Imdb: 'tt0816692' } }).shareUrl).toBe(
      'https://www.imdb.com/title/tt0816692/',
    );
  });

  it('builds shared information from public metadata rather than server or playback URLs', () => {
    const info = getDetailExternalInfo({
      ...movie,
      path: '/private/media/movie.mkv',
      raw: { streamUrl: 'https://server.example/video?api_key=private' },
    });
    expect(new URL(info.shareUrl).hostname).toBe('www.themoviedb.org');
    expect(info.title).toBe('星际穿越 (2014)');
    expect(JSON.stringify(info)).not.toContain('server.example');
    expect(JSON.stringify(info)).not.toContain('/private/');
  });
});
