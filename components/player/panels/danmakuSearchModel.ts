import type { DanmakuEpisodeSelection, SourcedDanmakuAnime } from '@/services/danmaku';
import { danmakuTitleSeason } from '@/services/danmakuMatching';

export function danmakuLeafSelection(
  entry: SourcedDanmakuAnime,
): DanmakuEpisodeSelection | undefined {
  return entry.anime.episodes.length === 1
    ? { ...entry, episode: entry.anime.episodes[0] }
    : undefined;
}

export const danmakuSeasonKey = (entry: SourcedDanmakuAnime) => {
  const season = danmakuTitleSeason(entry.anime.animeTitle);
  return season == null ? 'unspecified' : String(season);
};

export function danmakuSeasonOptions(entries: readonly SourcedDanmakuAnime[]) {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const key = danmakuSeasonKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [
    { value: 'all', title: '全部季度 / 版本' },
    ...[...counts]
      .sort(([a], [b]) => {
        if (a === 'unspecified') return 1;
        if (b === 'unspecified') return -1;
        return Number(a) - Number(b);
      })
      .map(([key, count]) => ({
        value: key,
        title:
          (key === 'unspecified' ? '未标注季度 / 特别篇' : '第 ' + key + ' 季') + ' · ' + count,
      })),
  ];
}
