import type { MediaItem } from '@/services/media/types';

export type DetailExternalLink = {
  provider: 'tmdb' | 'imdb';
  label: string;
  url: string;
  isDirect: boolean;
};

function providerId(item: MediaItem | null | undefined, provider: string) {
  return Object.entries(item?.providerIds ?? {})
    .find(([key]) => key.toLowerCase() === provider)?.[1]
    ?.trim();
}

function tmdbId(item: MediaItem | null | undefined) {
  const id = providerId(item, 'tmdb');
  return id && /^[1-9]\d*$/.test(id) ? id : undefined;
}

function imdbId(item: MediaItem | null | undefined) {
  const id = providerId(item, 'imdb');
  return id && /^tt\d+$/i.test(id) ? id.toLowerCase() : undefined;
}

function validIndex(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function tmdbDetailUrl(item: MediaItem, series?: MediaItem | null) {
  const id = tmdbId(item);
  if (item.type === 'Movie' && id) return `https://www.themoviedb.org/movie/${id}`;
  if (item.type === 'Series' && id) return `https://www.themoviedb.org/tv/${id}`;
  if (item.type !== 'Episode' && item.type !== 'Season') return undefined;

  const seriesId = series?.type === 'Series' ? tmdbId(series) : undefined;
  if (!seriesId) return undefined;
  const seriesUrl = `https://www.themoviedb.org/tv/${seriesId}`;
  const seasonNumber = item.type === 'Season' ? item.indexNumber : item.parentIndexNumber;
  if (!validIndex(seasonNumber)) return seriesUrl;
  const seasonUrl = `${seriesUrl}/season/${seasonNumber}`;
  return item.type === 'Episode' && validIndex(item.indexNumber) && item.indexNumber > 0
    ? `${seasonUrl}/episode/${item.indexNumber}`
    : seasonUrl;
}

export function getDetailExternalInfo(item: MediaItem, series?: MediaItem | null) {
  const isSeriesChild = item.type === 'Episode' || item.type === 'Season';
  const searchTitle =
    (isSeriesChild
      ? series?.originalTitle || series?.name || item.seriesName
      : item.originalTitle) || item.name;
  const tmdbUrl = tmdbDetailUrl(item, series);
  const imdb = imdbId(item) || (isSeriesChild ? imdbId(series) : undefined);
  const links: DetailExternalLink[] = [
    {
      provider: 'tmdb',
      label: tmdbUrl ? '查看 TMDB' : '在 TMDB 搜索',
      url: tmdbUrl || `https://www.themoviedb.org/search?query=${encodeURIComponent(searchTitle)}`,
      isDirect: !!tmdbUrl,
    },
    {
      provider: 'imdb',
      label: imdb ? '查看 IMDb' : '在 IMDb 搜索',
      url: imdb
        ? `https://www.imdb.com/title/${imdb}/`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(searchTitle)}&s=tt`,
      isDirect: !!imdb,
    },
  ];
  let title = item.name;
  if (isSeriesChild) {
    const seriesName = item.seriesName || series?.name;
    const episodeNumber =
      item.type === 'Episode' && validIndex(item.parentIndexNumber) && validIndex(item.indexNumber)
        ? `S${item.parentIndexNumber}E${item.indexNumber}`
        : undefined;
    title = [seriesName, episodeNumber, item.name].filter(Boolean).join(' · ');
  } else if (item.productionYear) {
    title = `${item.name} (${item.productionYear})`;
  }

  return {
    title,
    links,
    shareUrl: (links.find((link) => link.isDirect) ?? links[0]).url,
  };
}
