import type { MediaItem } from './media/types';

export type DandanSearchResult = {
  hasMore: boolean;
  animes: DandanAnime[];
  errorCode: number;
  success: boolean;
  errorMessage: string;
};

export type DandanAnime = {
  animeId: number;
  animeTitle: string;
  type: string;
  typeDescription: string;
  episodes: DandanEpisode[];
};

export type DandanEpisode = {
  episodeId: number;
  episodeTitle: string;
};

export type DandanCommentResult = {
  count: number;
  comments: {
    cid: number;
    p: string;
    m: string;
  }[];
};

export const DANDAN_COMMENT_MODE = {
  Bottom: 4,
  Top: 5,
  Scroll: 1,
  ScrollBottom: 6,
} as const;

export type DandanCommentMode = (typeof DANDAN_COMMENT_MODE)[keyof typeof DANDAN_COMMENT_MODE];

export type DandanComment = {
  id: number;
  timeInSeconds: number;
  text: string;
  colorHex: string;
  mode: DandanCommentMode;
  user: string;
};

const BASE_URL = process.env.EXPO_PUBLIC_DANDANPLAY_API_URL;

type QueryParameter = boolean | number | string;

async function makeRequest<T>(
  endpoint: string,
  params?: Record<string, QueryParameter>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function searchAnimesByKeyword(keyword: string): Promise<DandanAnime[]> {
  const res = await makeRequest<DandanSearchResult>('/api/v2/search/episodes', {
    anime: keyword,
  });

  return res?.animes ?? [];
}

export async function searchEpisodesByKeyword(keyword: string): Promise<DandanEpisode[]> {
  const animes = await searchAnimesByKeyword(keyword);
  return (animes ?? []).flatMap((anime) => anime.episodes);
}

export async function getCommentsByEpisodeId(episodeId: number): Promise<DandanComment[]> {
  const res = await makeRequest<DandanCommentResult>(`/api/v2/comment/${episodeId}`, {
    withRelated: true,
    chConvert: 1,
    protect: 1,
  });

  const list = res?.comments ?? [];

  const normalize = (c: DandanCommentResult['comments'][number]): DandanComment | null => {
    if (!c || !c.p) return null;
    const parts = String(c.p).split(',');
    const timeInSeconds = parseFloat(parts[0] || '0') || 0;
    const mode = (parseInt(parts[1] || '1', 10) || 1) as DandanCommentMode;
    const colorNumber = parseInt(parts[2] || '16777215', 10) || 0xffffff;
    const colorHex = `#${colorNumber.toString(16).padStart(6, '0')}`;
    const text = String(c.m ?? '');
    if (!text) return null;

    // 提取用户信息用于过滤
    const user = parts[3] || '';

    return { id: c.cid, timeInSeconds, text, colorHex, mode, user };
  };

  return (Array.isArray(list) ? list : []).map(normalize).filter(Boolean) as DandanComment[];
}

export function selectDandanEpisode(
  animes: DandanAnime[],
  seasonNumber: number,
  episodeNumber: number | null | undefined,
) {
  if (!episodeNumber || seasonNumber < 1 || episodeNumber < 1) return undefined;

  const anime = animes[seasonNumber - 1];
  const episode = anime?.episodes[episodeNumber - 1];
  return anime && episode ? { anime, episode } : undefined;
}

export async function getCommentsByItem(item: MediaItem, originalTitle?: string | null) {
  const emptyResult = { comments: [], episodeInfo: undefined };
  const keywords = [item.seriesName, originalTitle]
    .map((value) => value?.trim())
    .filter((value, index, values): value is string => !!value && values.indexOf(value) === index);

  let animes: DandanAnime[] = [];
  for (const keyword of keywords) {
    animes = await searchAnimesByKeyword(keyword);
    if (animes.length > 0) break;
  }

  const match = selectDandanEpisode(animes, item.parentIndexNumber ?? 1, item.indexNumber);
  if (!match) return emptyResult;

  const comments = await getCommentsByEpisodeId(match.episode.episodeId);
  return {
    comments,
    episodeInfo: {
      animeTitle: match.anime.animeTitle,
      episodeTitle: match.episode.episodeTitle,
    },
  };
}

export function groupCommentsBySecond(comments: DandanComment[]): Map<number, DandanComment[]> {
  const map = new Map<number, DandanComment[]>();
  for (const c of comments) {
    const second = Math.floor(c.timeInSeconds);
    const bucket = map.get(second);
    if (bucket) {
      bucket.push(c);
    } else {
      map.set(second, [c]);
    }
  }
  return map;
}
