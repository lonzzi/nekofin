import { t as tr } from '@/lib/i18n';

import {
  getAnimeEpisodes,
  getCommentsByEpisodeId,
  searchAnimesByKeyword,
  type DandanAnime,
  type DandanComment,
  type DandanEpisode,
} from './dandanplay';
import { findDandanEpisode, scoreDanmakuAnime } from './danmakuMatching';
import { mergeDanmakuComments } from './danmakuMerge';
import type { DanmakuApiSource } from './danmakuSources';
import type { MediaItem } from './media/types';

export type SourcedDanmakuAnime = { key: string; source: DanmakuApiSource; anime: DandanAnime };
export type DanmakuEpisodeSelection = SourcedDanmakuAnime & {
  episode: DandanEpisode;
  score?: number;
};
export type DanmakuTrack = {
  id: string;
  sourceId: string;
  sourceName: string;
  animeTitle: string;
  episodeTitle: string;
  comments: DandanComment[];
  matchScore: number;
};
export type DanmakuCommentsData = {
  comments: DandanComment[];
  episodeInfo?: { animeTitle: string; episodeTitle: string };
  tracks?: DanmakuTrack[];
  failedSources?: string[];
};

export function danmakuAnimeKey(source: DanmakuApiSource, anime: DandanAnime): string {
  return source.id + ':' + anime.animeId + ':' + anime.animeTitle;
}

export async function searchDanmaku(
  keyword: string,
  sources: DanmakuApiSource[],
  signal?: AbortSignal,
  episodeNumber?: number,
  seasonNumber?: number,
) {
  const enabled = sources.filter((source) => source.enabled);
  const results = await Promise.allSettled(
    enabled.map(async (source) => {
      const animes = await searchAnimesByKeyword(keyword, {
        baseUrl: source.baseUrl,
        signal,
        episodeNumber,
        seasonNumber,
      });
      return animes.map((anime) => ({ key: danmakuAnimeKey(source, anime), source, anime }));
    }),
  );
  if (signal?.aborted) throw new Error(tr('search.canceled'));
  const animes: SourcedDanmakuAnime[] = [];
  const failedSources: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') animes.push(...result.value);
    else failedSources.push(enabled[index].name);
  });
  return { animes, failedSources };
}

export function rankDanmakuTracks(tracks: DanmakuTrack[]): DanmakuTrack[] {
  return [...tracks].sort(
    (a, b) =>
      Number(b.comments.length > 0) - Number(a.comments.length > 0) ||
      b.matchScore - a.matchScore ||
      b.comments.length - a.comments.length ||
      a.id.localeCompare(b.id),
  );
}

export function mergeDanmakuTracks(tracks: DanmakuTrack[]): DandanComment[] {
  return mergeDanmakuComments(rankDanmakuTracks(tracks).map((track) => track.comments));
}

export function resolveDanmakuSelection(
  data: DanmakuCommentsData | undefined,
  selection: string,
): DanmakuCommentsData {
  const tracks = rankDanmakuTracks(data?.tracks ?? []);
  if (!tracks.length) return data ?? { comments: [] };
  const selected = tracks.find((track) => track.id === selection) ?? tracks[0];
  return {
    ...data,
    tracks,
    comments: selection === 'merge' ? mergeDanmakuTracks(tracks) : selected.comments,
    episodeInfo: {
      animeTitle:
        selection === 'merge'
          ? tr('danmaku.mergedSourceCount', { count: tracks.length })
          : selected.sourceName + ' · ' + selected.animeTitle,
      episodeTitle: selected.episodeTitle,
    },
  };
}

export async function loadDanmakuSelections(
  selections: DanmakuEpisodeSelection[],
  signal?: AbortSignal,
): Promise<DanmakuCommentsData> {
  // Different APIs run in parallel; a single API is read sequentially to avoid rate limits.
  const groups = new Map<string, DanmakuEpisodeSelection[]>();
  for (const selection of selections) {
    const group = groups.get(selection.source.id) ?? [];
    if (
      !group.some(
        (entry) => String(entry.episode.episodeId) === String(selection.episode.episodeId),
      )
    )
      group.push(selection);
    groups.set(selection.source.id, group);
  }
  const results = await Promise.all(
    [...groups.values()].map(async (group) => {
      const tracks: DanmakuTrack[] = [];
      let failed = false;
      for (const selection of group) {
        if (signal?.aborted) break;
        try {
          const comments = await getCommentsByEpisodeId(selection.episode.episodeId, {
            baseUrl: selection.source.baseUrl,
            signal,
          });
          tracks.push({
            id: selection.source.id + ':' + selection.episode.episodeId,
            sourceId: selection.source.id,
            sourceName: selection.source.name,
            animeTitle: selection.anime.animeTitle,
            episodeTitle: selection.episode.episodeTitle,
            comments,
            matchScore: selection.score ?? 1,
          });
        } catch {
          failed = true;
        }
      }
      return { tracks, failed, name: group[0].source.name };
    }),
  );
  if (signal?.aborted) throw new Error(tr('danmaku.loadingCanceled'));
  const tracks = rankDanmakuTracks(results.flatMap((result) => result.tracks));
  return resolveDanmakuSelection(
    {
      comments: [],
      tracks,
      failedSources: results.filter((result) => result.failed).map((result) => result.name),
    },
    'auto',
  );
}

export async function getDanmakuByItem(
  item: MediaItem,
  originalTitle: string | null | undefined,
  sources: DanmakuApiSource[],
  signal?: AbortSignal,
): Promise<DanmakuCommentsData> {
  const titles = [
    ...new Set(
      [item.seriesName, originalTitle, item.type === 'Movie' ? item.name : undefined]
        .map((title) => title?.trim())
        .filter((title): title is string => !!title),
    ),
  ];
  if (!titles.length || !sources.some((source) => source.enabled))
    return { comments: [], tracks: [] };
  const season = item.parentIndexNumber ?? 1;
  const episodeNumber = item.type === 'Movie' ? 1 : item.indexNumber;
  const results = await Promise.all(
    sources
      .filter((source) => source.enabled)
      .map(async (source) => {
        const candidates = new Map<string, SourcedDanmakuAnime>();
        let searched = false;
        let failed = false;
        // Search every distinct alias. A hit from one provider must not hide another alias.
        for (const title of titles) {
          if (signal?.aborted) break;
          try {
            const animes = await searchAnimesByKeyword(title, {
              baseUrl: source.baseUrl,
              signal,
              episodeNumber: episodeNumber ?? undefined,
              seasonNumber: season,
            });
            searched = true;
            for (const anime of animes) {
              const key = danmakuAnimeKey(source, anime);
              candidates.set(key, { key, source, anime });
            }
          } catch {
            failed = true;
          }
        }
        const ranked = [...candidates.values()]
          .filter(({ anime }) => item.type !== 'Movie' || anime.type !== 'tvseries')
          .map((entry) => ({ ...entry, score: scoreDanmakuAnime(entry.anime, titles, season) }))
          .filter((entry) => entry.score >= 0.55)
          .sort((a, b) => b.score - a.score);
        const best = ranked[0]?.score ?? 0;
        const selections: DanmakuEpisodeSelection[] = [];
        for (const entry of ranked.filter((entry) => entry.score >= best - 0.04)) {
          if (signal?.aborted) break;
          try {
            const episodes = await getAnimeEpisodes(entry.anime, {
              baseUrl: source.baseUrl,
              signal,
            });
            const episode = findDandanEpisode(episodes, episodeNumber);
            if (episode) selections.push({ ...entry, episode });
          } catch {
            failed = true;
          }
        }
        return { selections, failed: failed || !searched, name: source.name };
      }),
  );
  if (signal?.aborted) throw new Error(tr('danmaku.matchingCanceled'));
  // Compare title confidence across APIs before considering comment volume.
  const selections = results.flatMap((result) => result.selections);
  const bestScore = Math.max(0, ...selections.map((selection) => selection.score ?? 0));
  const data = await loadDanmakuSelections(
    selections.filter((selection) => (selection.score ?? 0) >= bestScore - 0.04),
    signal,
  );
  data.failedSources = [
    ...new Set([
      ...(data.failedSources ?? []),
      ...results.filter((result) => result.failed).map((result) => result.name),
    ]),
  ];
  return data;
}
