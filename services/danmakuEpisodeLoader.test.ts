import { describe, expect, it, vi } from 'vitest';

import type { DanmakuCommentsData, DanmakuEpisodeSelection } from './danmaku';
import { createDanmakuEpisodeLoader, danmakuEpisodeCacheKey } from './danmakuEpisodeLoader';

const entry = (id: number, baseUrl = 'https://example.com/api/v2'): DanmakuEpisodeSelection => ({
  key: 'default:anime',
  source: { id: 'default', name: 'API', baseUrl, enabled: true },
  anime: {
    animeId: 1,
    animeTitle: 'Re0 第二季 后半',
    type: 'tv',
    typeDescription: 'TV动画',
    episodes: [],
  },
  episode: { episodeId: id, episodeTitle: '第' + id + '话' },
});
const result = (id: number): DanmakuCommentsData => ({
  comments: [],
  tracks: [
    {
      id: String(id),
      sourceId: 'default',
      sourceName: 'API',
      animeTitle: 'Re0',
      episodeTitle: String(id),
      comments: [],
      matchScore: 1,
    },
  ],
});
const signal = () => new AbortController().signal;

describe('episode comment previews', () => {
  it('reads one episode at a time and reuses its comments when the whole row is tapped', async () => {
    let finishFirst!: (data: DanmakuCommentsData) => void;
    const fetchEpisode = vi.fn((selection: DanmakuEpisodeSelection) =>
      selection.episode.episodeId === 1
        ? new Promise<DanmakuCommentsData>((resolve) => {
            finishFirst = resolve;
          })
        : Promise.resolve(result(2)),
    );
    const loader = createDanmakuEpisodeLoader(fetchEpisode);
    const first = loader.load(entry(1), signal());
    const second = loader.load(entry(2), signal());
    const selected = loader.load(entry(1), signal(), true);
    expect(selected).toBe(first);
    expect(fetchEpisode).toHaveBeenCalledTimes(1);
    const data = result(1);
    finishFirst(data);
    expect(await selected).toBe(data);
    await second;
    expect(await loader.load(entry(1), signal(), true)).toBe(data);
    expect(fetchEpisode).toHaveBeenCalledTimes(2);
  });

  it('prioritizes a tapped episode over an unrelated background count request', async () => {
    const order: number[] = [];
    const fetchEpisode = vi.fn((selection: DanmakuEpisodeSelection, abortSignal: AbortSignal) => {
      const id = Number(selection.episode.episodeId);
      order.push(id);
      if (id !== 1) return Promise.resolve(result(id));
      return new Promise<DanmakuCommentsData>((_, reject) =>
        abortSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      );
    });
    const loader = createDanmakuEpisodeLoader(fetchEpisode);
    const background = loader.load(entry(1), signal()).catch(() => undefined);
    const queued = loader.load(entry(2), signal());
    await loader.load(entry(3), signal(), true);
    await Promise.all([background, queued]);
    expect(order).toEqual([1, 3, 2]);
  });

  it('bounds full-comment retention and separates identical IDs on different API addresses', async () => {
    const fetchEpisode = vi.fn(async (selection: DanmakuEpisodeSelection) =>
      result(Number(selection.episode.episodeId)),
    );
    const loader = createDanmakuEpisodeLoader(fetchEpisode);
    for (const id of [1, 2, 3, 4, 1]) await loader.load(entry(id), signal());
    expect(fetchEpisode).toHaveBeenCalledTimes(5);
    await loader.load(entry(1, 'https://other.example/api/v2'), signal());
    expect(fetchEpisode).toHaveBeenCalledTimes(6);
    expect(
      danmakuEpisodeCacheKey(entry(1, 'https://example.com/api/v1/private-token')),
    ).not.toContain('private-token');
  });

  it('does not cache an unavailable API response as zero comments', async () => {
    const fetchEpisode = vi.fn(async () => ({ comments: [], failedSources: ['API'] }));
    const loader = createDanmakuEpisodeLoader(fetchEpisode);
    await expect(loader.load(entry(1), signal())).rejects.toThrow('弹幕数量暂不可用');
    await expect(loader.load(entry(1), signal())).rejects.toThrow('弹幕数量暂不可用');
    expect(fetchEpisode).toHaveBeenCalledTimes(2);
  });

  it('skips a cancelled episode while another preview is in progress', async () => {
    let finishFirst!: (data: DanmakuCommentsData) => void;
    const fetchEpisode = vi.fn(
      () =>
        new Promise<DanmakuCommentsData>((resolve) => {
          finishFirst = resolve;
        }),
    );
    const loader = createDanmakuEpisodeLoader(fetchEpisode);
    const first = loader.load(entry(1), signal());
    const cancelled = new AbortController();
    const second = loader.load(entry(2), cancelled.signal);
    cancelled.abort();
    finishFirst(result(1));
    await first;
    await expect(second).rejects.toBeDefined();
    expect(fetchEpisode).toHaveBeenCalledTimes(1);
  });

  it('restarts a cancelled preview when that episode is tapped before the queue advances', async () => {
    let finishFirst!: (data: DanmakuCommentsData) => void;
    const fetchEpisode = vi.fn((selection: DanmakuEpisodeSelection) =>
      selection.episode.episodeId === 1
        ? new Promise<DanmakuCommentsData>((resolve) => {
            finishFirst = resolve;
          })
        : Promise.resolve(result(2)),
    );
    const loader = createDanmakuEpisodeLoader(fetchEpisode);
    const first = loader.load(entry(1), signal()).catch(() => undefined);
    const cancelled = new AbortController();
    const preview = loader.load(entry(2), cancelled.signal).catch(() => undefined);
    cancelled.abort();
    const tapped = loader.load(entry(2), signal(), true);
    finishFirst(result(1));
    expect(await tapped).toEqual(result(2));
    await Promise.all([first, preview]);
    expect(fetchEpisode).toHaveBeenCalledTimes(2);
  });
});
