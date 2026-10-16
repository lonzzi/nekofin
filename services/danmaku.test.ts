import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAnimeEpisodes,
  getCommentsByEpisodeId,
  searchAnimesByKeyword,
  type DandanAnime,
  type DandanComment,
} from './dandanplay';
import {
  getDanmakuByItem,
  loadDanmakuSelections,
  mergeDanmakuTracks,
  resolveDanmakuSelection,
  searchDanmaku,
  type DanmakuTrack,
} from './danmaku';
import { findDandanEpisode, scoreDanmakuAnime, selectDandanEpisode } from './danmakuMatching';

const sources = [
  { id: 'default', name: '默认 API', baseUrl: 'https://default.test/api/v2', enabled: true },
  { id: 'custom', name: '自建', baseUrl: 'https://custom.test/api/v1/token', enabled: true },
];
const anime = (title = '测试番剧 第二季', id = 1): DandanAnime => ({
  animeId: id,
  animeTitle: title,
  type: 'tvseries',
  typeDescription: 'TV',
  episodes: [{ episodeId: 101, episodeTitle: '第1话' }],
});
const comment = (text: string, timeInSeconds = 1): DandanComment => ({
  id: 1,
  text,
  timeInSeconds,
  mode: 1,
  colorHex: '#ffffff',
  user: 'user',
});
const track = (id: string, comments: DandanComment[], matchScore = 1): DanmakuTrack => ({
  id,
  sourceId: id,
  sourceName: id,
  animeTitle: '测试番剧',
  episodeTitle: '第1话',
  comments,
  matchScore,
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('matching and merging', () => {
  it('matches seasons by title rather than mixed-provider result position', () => {
    const results = [
      anime('测试番剧 第一季', 1),
      anime('测试番剧 第一季 from provider2', 2),
      anime('测试番剧 第二季', 3),
    ];
    expect(selectDandanEpisode(results, 2, 1)?.anime.animeId).toBe(3);
    expect(scoreDanmakuAnime(results[0], ['测试番剧 第二季'], 1)).toBe(0);
    expect(scoreDanmakuAnime(results[2], ['测试番剧 第二季'], 1)).toBe(1);
  });
  it('matches explicit episode numbers with gaps without selecting the wrong episode', () => {
    const episodes = [
      { episodeId: 1, episodeTitle: '第1话' },
      { episodeId: 3, episodeTitle: '第3话' },
    ];
    expect(findDandanEpisode(episodes, 2)).toBeUndefined();
    expect(findDandanEpisode(episodes, 3)?.episodeId).toBe(3);
    expect(findDandanEpisode([{ episodeId: 3, episodeTitle: 'S02E03' }], 3)?.episodeId).toBe(3);
    expect(
      findDandanEpisode([{ episodeId: 4, episodeTitle: '起点', episodeNumber: '4' }], 4)?.episodeId,
    ).toBe(4);
  });
  it('keeps title matching ahead of volume and chooses the most populated equivalent match', () => {
    const tracks = [
      track(
        'wrong',
        Array.from({ length: 20 }, () => comment('unrelated')),
        0.6,
      ),
      track('few', [comment('a')]),
      track('many', [comment('a'), comment('b')]),
    ];
    const resolved = resolveDanmakuSelection({ comments: [], tracks }, 'auto');
    expect(resolved.episodeInfo?.animeTitle).toContain('many');
    expect(resolved.comments).toHaveLength(2);
    expect(resolveDanmakuSelection({ comments: [], tracks }, 'few').comments).toHaveLength(1);
    expect(
      resolveDanmakuSelection(
        { comments: [], tracks: [track('empty', [], 1), track('available', [comment('a')], 0.98)] },
        'auto',
      ).comments,
    ).toHaveLength(1);
  });
  it('deduplicates overlapping APIs and assigns unique IDs while preserving repeated chants', () => {
    const merged = mergeDanmakuTracks([
      track('a', [
        comment('same'),
        { ...comment('same'), user: 'other-user' },
        comment('later', 4),
      ]),
      track('b', [comment('same'), comment('other', 2), comment('same', 8)]),
    ]);
    expect(merged.map((entry) => entry.text)).toEqual(['same', 'same', 'other', 'later', 'same']);
    expect(new Set(merged.map((entry) => entry.id)).size).toBe(merged.length);
    const original = [comment('same'), comment('same')];
    expect(
      resolveDanmakuSelection({ comments: [], tracks: [track('a', original)] }, 'auto').comments,
    ).toBe(original);
    expect(
      resolveDanmakuSelection(
        { comments: [], tracks: [track('a', [comment('a')]), track('b', [comment('b')])] },
        'merge',
      ).comments,
    ).toHaveLength(2);
  });
});

describe('compatible APIs', () => {
  it('browses all Re0 seasons by title without an episode-number filter', async () => {
    const versions = [
      anime('Re：从零开始的异世界生活', 1),
      anime('Re：从零开始的异世界生活 Memory Snow', 2),
      anime('Re：从零开始的异世界生活 第二季', 3),
      anime('Re：从零开始的异世界生活 第二季 后半', 4),
      anime('Re：从零开始的异世界生活 第三季', 5),
      anime('Re：从零开始的异世界生活 第四季', 6),
    ];
    const requests: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        requests.push(parsed);
        return json({ success: true, animes: parsed.searchParams.has('episode') ? [] : versions });
      }),
    );
    const result = await searchDanmaku('Re：从零开始的异世界生活', [sources[0]]);
    expect(result.animes.map((entry) => entry.anime.animeTitle)).toEqual(
      versions.map((entry) => entry.animeTitle),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.has('episode')).toBe(false);
  });

  it('supports fallback search and string bangumi IDs without dropping the token prefix', async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        urls.push(parsed);
        if (parsed.pathname.endsWith('/search/episodes'))
          return json({ success: true, animes: [] });
        if (parsed.pathname.endsWith('/search/anime'))
          return json({
            success: true,
            animes: [{ ...anime(), bangumiId: 'A900000', episodes: undefined }],
          });
        if (parsed.pathname.endsWith('/bangumi/A900000'))
          return json({
            success: true,
            bangumi: { episodes: [{ episodeId: 123, episodeTitle: '1' }] },
          });
        return json({}, 404);
      }),
    );
    const options = { baseUrl: sources[1].baseUrl };
    const result = await searchAnimesByKeyword('测试番剧', options);
    expect(await getAnimeEpisodes(result[0], options)).toHaveLength(1);
    expect(urls.every((url) => url.pathname.startsWith('/api/v1/token/'))).toBe(true);
    expect(urls[1].searchParams.get('keyword')).toBe('测试番剧');
  });
  it('keeps API identities separate even when their anime and episode IDs collide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ success: true, animes: [anime()] })),
    );
    const result = await searchDanmaku('测试番剧', sources);
    expect(new Set(result.animes.map((entry) => entry.key)).size).toBe(2);
  });
  it('uses actual comment counts, searches aliases, and isolates source failures', async () => {
    const searched: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        if (parsed.hostname === 'custom.test') throw new Error('offline');
        if (parsed.pathname.endsWith('/search/episodes')) {
          const keyword = parsed.searchParams.get('anime')!;
          searched.push(keyword);
          return json({
            success: true,
            animes:
              keyword === 'Alias'
                ? [
                    {
                      ...anime('Alias'),
                      episodes: [{ episodeId: 101, episodeTitle: '1', commentCount: 999 }],
                    },
                    {
                      ...anime('Alias from provider2', 2),
                      episodes: [{ episodeId: 102, episodeTitle: '1', commentCount: 1 }],
                    },
                  ]
                : [anime('Unrelated')],
          });
        }
        const count = parsed.pathname.endsWith('/102') ? 3 : 1;
        return json({
          count,
          comments: Array.from({ length: count }, (_, i) => ({
            cid: i,
            p: '1,1,16777215,u',
            m: 'comment' + i,
          })),
        });
      }),
    );
    const data = await getDanmakuByItem(
      {
        id: 'ep',
        name: '1',
        type: 'Episode',
        seriesName: '正式名称',
        indexNumber: 1,
        parentIndexNumber: 1,
        raw: {},
      },
      'Alias',
      sources,
    );
    expect(searched).toEqual(['正式名称', 'Alias']);
    expect(data.comments).toHaveLength(3);
    expect(data.tracks).toHaveLength(2);
    expect(data.failedSources).toEqual(['自建']);
  });
  it('loads different APIs independently but serializes requests within an API', async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return json({ comments: [{ cid: 1, p: '1,1,0,u', m: 'black' }] });
      }),
    );
    const entry = { key: 'a', source: sources[0], anime: anime() };
    const data = await loadDanmakuSelections([
      {
        ...entry,
        episode: { episodeId: 1, episodeTitle: '1' },
      },
      { ...entry, episode: { episodeId: 2, episodeTitle: '2' } },
    ]);
    expect(peak).toBe(1);
    expect(data.tracks).toHaveLength(2);
    expect(data.comments[0].colorHex).toBe('#000000');
  });
  it('omits malformed comments without interpreting them as zero-time events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          comments: [
            { cid: 1, p: 'invalid,1,16777215,u', m: 'bad' },
            { cid: 2, p: '0,1,16777215,u', m: 'start' },
          ],
        }),
      ),
    );
    expect(
      (await getCommentsByEpisodeId(1, { baseUrl: sources[0].baseUrl })).map((entry) => entry.text),
    ).toEqual(['start']);
  });
  it('uses a complete season/episode code for compatible fallback searches', async () => {
    const keywords: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/search/episodes'))
          return json({ success: true, animes: [] });
        keywords.push(parsed.searchParams.get('keyword')!);
        return json({ success: true, animes: [anime()] });
      }),
    );
    await searchAnimesByKeyword('测试番剧 第二季', {
      baseUrl: sources[1].baseUrl,
      episodeNumber: 3,
    });
    expect(keywords).toEqual(['测试番剧 第二季 S02E03']);
    await searchAnimesByKeyword('测试番剧', {
      baseUrl: sources[1].baseUrl,
      episodeNumber: 3,
      seasonNumber: 2,
    });
    expect(keywords[1]).toBe('测试番剧 S02E03');
  });
  it('does not repeat a failed network request through the fallback endpoint', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await searchDanmaku('测试', [sources[0]]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.failedSources).toEqual(['默认 API']);
  });
  it('cancels superseded searches instead of returning late results', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort();
        return json({ success: true, animes: [anime()] });
      }),
    );
    await expect(searchDanmaku('测试', sources, controller.signal)).rejects.toThrow('取消');
  });
});
