import { t as tr } from '@/lib/i18n';

import { danmakuTitleSeason } from './danmakuMatching';
import { danmakuEndpointUrl, DEFAULT_DANMAKU_SOURCE } from './danmakuSources';
import type { MediaItem } from './media/types';

export { selectDandanEpisode } from './danmakuMatching';
export type DandanId = string | number;
export type DandanSearchResult = {
  hasMore: boolean;
  animes: DandanAnime[];
  errorCode: number;
  success: boolean;
  errorMessage: string;
};
export type DandanAnime = {
  animeId: DandanId;
  bangumiId?: DandanId;
  animeTitle: string;
  type: string;
  typeDescription: string;
  episodes: DandanEpisode[];
  episodeCount?: number;
};
export type DandanEpisode = {
  episodeId: DandanId;
  episodeTitle: string;
  episodeNumber?: string | number;
  commentCount?: number;
};
export type DandanCommentResult = {
  count: number;
  comments: { cid: number; p: string; m: string }[];
};
export const DANDAN_COMMENT_MODE = { Bottom: 4, Top: 5, Scroll: 1, ScrollBottom: 6 } as const;
export type DandanCommentMode = (typeof DANDAN_COMMENT_MODE)[keyof typeof DANDAN_COMMENT_MODE];
export type DandanComment = {
  id: number;
  timeInSeconds: number;
  text: string;
  colorHex: string;
  mode: DandanCommentMode;
  user: string;
};
export type DandanRequestOptions = {
  baseUrl?: string;
  signal?: AbortSignal;
  episodeNumber?: number;
  seasonNumber?: number;
};
type QueryParameter = boolean | number | string;
class DandanApiError extends Error {
  constructor(public status: number) {
    super(tr('danmaku.apiHttpError', { status: status }));
  }
}

async function makeRequest<T>(
  endpoint: string,
  params?: Record<string, QueryParameter>,
  options: DandanRequestOptions = {},
): Promise<T> {
  const url = danmakuEndpointUrl(options.baseUrl ?? DEFAULT_DANMAKU_SOURCE.baseUrl, endpoint);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, endpoint === '/search/anime' ? 45000 : 20000);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new DandanApiError(response.status);
    const result = await response.json();
    if (result?.success === false) throw new Error(tr('danmaku.apiResponseError'));
    return result;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function searchAnimesByKeyword(
  keyword: string,
  options?: DandanRequestOptions,
): Promise<DandanAnime[]> {
  let primaryError: unknown;
  try {
    const result = await makeRequest<DandanSearchResult>(
      '/search/episodes',
      {
        anime: keyword,
        ...(options?.episodeNumber == null ? {} : { episode: options.episodeNumber }),
      },
      options,
    );
    if (result?.animes?.length)
      return result.animes.map((anime) => ({ ...anime, episodes: anime.episodes ?? [] }));
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    if (!(error instanceof DandanApiError) || ![404, 405].includes(error.status)) throw error;
    primaryError = error;
  }
  // Compatible APIs may expose external providers only through this fallback.
  try {
    const query =
      options?.episodeNumber == null || /\bS\d+E\d+\b|\bE\d+\b/i.test(keyword)
        ? keyword
        : keyword +
          ' S' +
          String(danmakuTitleSeason(keyword) ?? options.seasonNumber ?? 1).padStart(2, '0') +
          'E' +
          String(options.episodeNumber).padStart(2, '0');
    const result = await makeRequest<DandanSearchResult>(
      '/search/anime',
      { keyword: query },
      options,
    );
    return (result?.animes ?? []).map((anime) => ({ ...anime, episodes: anime.episodes ?? [] }));
  } catch (error) {
    if (!primaryError && error instanceof DandanApiError && [404, 405].includes(error.status))
      return [];
    throw error;
  }
}

export async function getAnimeEpisodes(
  anime: DandanAnime,
  options?: DandanRequestOptions,
): Promise<DandanEpisode[]> {
  if (anime.episodes.length) return anime.episodes;
  const result = await makeRequest<{ bangumi?: { episodes?: DandanEpisode[] } | null }>(
    '/bangumi/' + encodeURIComponent(String(anime.bangumiId ?? anime.animeId)),
    undefined,
    options,
  );
  return result.bangumi?.episodes ?? [];
}

export async function searchEpisodesByKeyword(keyword: string): Promise<DandanEpisode[]> {
  const animes = await searchAnimesByKeyword(keyword);
  const episodes: DandanEpisode[] = [];
  for (const anime of animes) episodes.push(...(await getAnimeEpisodes(anime)));
  return episodes;
}

export async function getCommentsByEpisodeId(
  episodeId: DandanId,
  options?: DandanRequestOptions,
): Promise<DandanComment[]> {
  const result = await makeRequest<DandanCommentResult>(
    '/comment/' + encodeURIComponent(String(episodeId)),
    { withRelated: true, chConvert: 1, protect: 1 },
    options,
  );
  const comments: DandanComment[] = [];
  for (const [index, comment] of (Array.isArray(result?.comments)
    ? result.comments
    : []
  ).entries()) {
    if (!comment?.p) continue;
    const parts = String(comment.p).split(',');
    const timeInSeconds = Number.parseFloat(parts[0]);
    const text = String(comment.m ?? '');
    if (!text || !Number.isFinite(timeInSeconds) || timeInSeconds < 0) continue;
    const parsedMode = Number.parseInt(parts[1], 10);
    const mode = ([1, 4, 5, 6].includes(parsedMode) ? parsedMode : 1) as DandanCommentMode;
    const parsedColor = Number.parseInt(parts[2], 10);
    const color = Number.isFinite(parsedColor)
      ? Math.max(0, Math.min(0xffffff, parsedColor))
      : 0xffffff;
    comments.push({
      id: Number.isFinite(comment.cid) ? comment.cid : index + 1,
      timeInSeconds,
      text,
      mode,
      colorHex: '#' + color.toString(16).padStart(6, '0'),
      user: parts[3] ?? '',
    });
  }
  return comments;
}

/** Legacy callers use the same matching pipeline as configured multi-source playback. */
export async function getCommentsByItem(item: MediaItem, originalTitle?: string | null) {
  const { getDanmakuByItem } = await import('./danmaku');
  return getDanmakuByItem(item, originalTitle, [DEFAULT_DANMAKU_SOURCE]);
}

export function groupCommentsBySecond(comments: DandanComment[]): Map<number, DandanComment[]> {
  const map = new Map<number, DandanComment[]>();
  for (const comment of comments) {
    const second = Math.floor(comment.timeInSeconds);
    const bucket = map.get(second);
    if (bucket) bucket.push(comment);
    else map.set(second, [comment]);
  }
  return map;
}
