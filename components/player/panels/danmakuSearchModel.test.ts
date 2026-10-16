import type { SourcedDanmakuAnime } from '@/services/danmaku';
import { describe, expect, it } from 'vitest';

import { danmakuLeafSelection, danmakuSeasonKey, danmakuSeasonOptions } from './danmakuSearchModel';

function anime(title: string, id: number, source = 'default'): SourcedDanmakuAnime {
  return {
    key: source + ':' + id,
    source: { id: source, name: source, baseUrl: 'https://example.com/api/v2', enabled: true },
    anime: {
      animeId: id,
      animeTitle: title,
      type: 'tvseries',
      typeDescription: 'TV动画',
      episodes: [],
    },
  };
}

describe('danmaku search seasons and episode selections', () => {
  it('loads a single-episode result directly with its source identity and comment metadata', () => {
    const result = anime('Re0 第二季 第14话', 1, 'custom');
    const episode = { episodeId: 14, episodeTitle: '第14话 STRAIGHT BET', commentCount: 6159 };
    expect(danmakuLeafSelection(result)).toBeUndefined();
    result.anime.episodes = [episode];
    expect(danmakuLeafSelection(result)).toEqual({ ...result, episode });
    result.anime.episodes.push({ episodeId: 15, episodeTitle: '第15话' });
    expect(danmakuLeafSelection(result)).toBeUndefined();
  });
  it('keeps Re0 second-season halves together without assuming specials are season one', () => {
    const entries = [
      anime('Re：从零开始的异世界生活', 1),
      anime('Re：从零开始的异世界生活 Memory Snow', 2),
      anime('Re：从零开始的异世界生活 第二季', 3),
      anime('Re：从零开始的异世界生活 第二季 后半', 4),
      anime('Re：从零开始的异世界生活 第三季', 5),
      anime('Re：从零开始的异世界生活 第四季', 6),
    ];
    expect(danmakuSeasonOptions(entries)).toEqual([
      { value: 'all', title: '全部季度 / 版本' },
      { value: '2', title: '第 2 季 · 2' },
      { value: '3', title: '第 3 季 · 1' },
      { value: '4', title: '第 4 季 · 1' },
      { value: 'unspecified', title: '未标注季度 / 特别篇 · 2' },
    ]);
  });

  it('preserves Titan final-season parts and movies as distinct versions', () => {
    const entries = [
      anime('进击的巨人 第三季 前篇', 1),
      anime('进击的巨人 第三季 后篇', 2),
      anime('进击的巨人 最终季', 3),
      anime('进击的巨人 最终季 Part.2', 4),
      anime('进击的巨人 最终季 完结篇', 5),
      anime('进击的巨人 完结篇 THE LAST ATTACK', 6),
    ];
    expect(entries.filter((entry) => danmakuSeasonKey(entry) === '3')).toHaveLength(2);
    expect(entries.filter((entry) => danmakuSeasonKey(entry) === 'unspecified')).toHaveLength(4);
  });
});
