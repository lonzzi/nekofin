import type { DandanAnime, DandanEpisode } from './dandanplay';

function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = '零一二三四五六七八九';
  if (value === '〇') return 0;
  const parts = value.split('十');
  if (parts.length === 2)
    return (
      (parts[0] ? digits.indexOf(parts[0]) : 1) * 10 + (parts[1] ? digits.indexOf(parts[1]) : 0)
    );
  return digits.indexOf(value);
}

export function danmakuTitleSeason(title: string): number | undefined {
  const chinese = title.match(/第\s*([零〇一二三四五六七八九十\d]+)\s*[季期]/);
  if (chinese) return chineseNumber(chinese[1]);
  const english = title.match(/(?:\bseason\s*|\bs)(\d+)(?:\b|(?=e\d))/i);
  if (english) return Number(english[1]);
  return undefined;
}

export function normalizeDanmakuTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s*from\s+[\w-]+.*$/i, '')
    .replace(/[（(]\s*来源[:：].*?[）)]/g, '')
    .replace(/[（(]\d{4}[）)]|【(?:动漫|电影|剧集)】/g, '')
    .replace(/\bs\d+e\d+\b|\be\d+\b/gi, '')
    .replace(/第\s*[零〇一二三四五六七八九十\d]+\s*[季期]|\bseason\s*\d+|\bs\d+\b/gi, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (value: string) => {
    const counts = new Map<string, number>();
    for (let i = 0; i < value.length - 1; i++) {
      const gram = value.slice(i, i + 2);
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
    return counts;
  };
  const left = grams(a);
  const right = grams(b);
  let overlap = 0;
  left.forEach((count, gram) => {
    overlap += Math.min(count, right.get(gram) ?? 0);
  });
  return (2 * overlap) / Math.max(1, a.length + b.length - 2);
}

export function scoreDanmakuAnime(
  anime: DandanAnime,
  titles: string[],
  seasonNumber: number,
): number {
  const requestedSeason =
    titles.map(danmakuTitleSeason).find((value) => value !== undefined) ?? seasonNumber;
  const candidateSeason = danmakuTitleSeason(anime.animeTitle);
  if (candidateSeason !== undefined && candidateSeason !== requestedSeason) return 0;
  const similarity = Math.max(
    0,
    ...titles.map((title) =>
      titleSimilarity(normalizeDanmakuTitle(title), normalizeDanmakuTitle(anime.animeTitle)),
    ),
  );
  return Math.max(
    0,
    similarity - (candidateSeason === undefined && requestedSeason > 1 ? 0.12 : 0),
  );
}

export function findDandanEpisode(
  episodes: DandanEpisode[],
  episodeNumber: number | null | undefined,
): DandanEpisode | undefined {
  if (episodeNumber == null || episodeNumber < 0 || !Number.isInteger(episodeNumber))
    return undefined;
  const numbered = episodes.map((episode) => {
    const explicit = episode.episodeNumber == null ? undefined : Number(episode.episodeNumber);
    const match = episode.episodeTitle.match(
      /(?:\bS\d+E|\bEP?|\bEpisode\s*|第)\s*(\d+(?:\.\d+)?)(?:\s*[话話集])?|^\s*(\d+(?:\.\d+)?)(?:\s|$|[.、:_-])/i,
    );
    const number = Number.isFinite(explicit)
      ? explicit
      : match
        ? Number(match[1] ?? match[2])
        : undefined;
    return { episode, number };
  });
  const match = numbered.find((entry) => entry.number === episodeNumber);
  if (match) return match.episode;
  // Only use positional fallback when this API supplies no episode numbers at all.
  if (numbered.every((entry) => entry.number === undefined) && episodeNumber > 0) {
    return episodes[episodeNumber - 1];
  }
  return undefined;
}

export function selectDandanEpisode(
  animes: DandanAnime[],
  seasonNumber: number,
  episodeNumber: number | null | undefined,
) {
  if (seasonNumber < 1) return undefined;
  for (const anime of animes) {
    const season = danmakuTitleSeason(anime.animeTitle) ?? 1;
    if (season !== seasonNumber) continue;
    const episode = findDandanEpisode(anime.episodes, episodeNumber);
    if (episode) return { anime, episode };
  }
  return undefined;
}
