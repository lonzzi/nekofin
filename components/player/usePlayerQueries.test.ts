import type { PlaybackPreferences } from '@/services/media/playbackSelection';
import type { MediaItem, MediaSegment, MediaServerInfo, MediaSource } from '@/services/media/types';
import { beforeEach, expect, it, vi } from 'vitest';

import { usePlayerQueries } from './usePlayerQueries';

const state = vi.hoisted(() => ({
  sources: [] as MediaSource[],
  prefetch: vi.fn(),
  events: [] as string[],
  sourcesPending: false,
  streamOptions: vi.fn(),
  streamEnabled: false,
  subtitleChoice: undefined as PlaybackPreferences['subtitleChoice'],
  item: undefined as MediaItem | undefined,
  sourceItems: {} as Record<string, MediaItem>,
  segmentSets: {} as Record<string, MediaSegment[]>,
  server: null as MediaServerInfo | null,
  segmentOptions: vi.fn(),
  streamInfo: undefined as { mediaSource: { Id: string } } | undefined,
}));
vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }));
vi.mock('@/hooks/usePlaybackPreferences', () => ({
  readPlaybackPreferences: () => ({ subtitleChoice: state.subtitleChoice }),
}));
vi.mock('@/hooks/useSubtitlePrefetch', () => ({
  useSubtitlePrefetch: (...args: unknown[]) => {
    state.events.push('prefetch');
    state.prefetch(...args);
  },
}));
vi.mock('@/lib/contexts/DanmakuSourcesContext', () => ({
  useDanmakuSources: () => ({ sources: [] }),
}));
vi.mock('@/lib/contexts/DanmakuSettingsContext', () => ({
  useDanmakuSettings: () => ({ settings: { enabled: false } }),
}));
vi.mock('@/services/danmaku', () => ({ getDanmakuByItem: vi.fn() }));
vi.mock('@/services/danmakuSources', () => ({ danmakuSourcesKey: () => 'none' }));
vi.mock('@/services/dandanplayQueryOptions', () => ({
  dandanplayCommentsQueryOptions: () => ({ queryKey: ['comments'] }),
}));
vi.mock('@/services/media/queryOptions', () => ({
  itemDetailQueryOptions: () => ({ queryKey: ['series'] }),
  playbackItemDetailQueryOptions: ({ itemId }: { itemId?: string }) => ({
    queryKey: ['item', itemId ?? 'none'],
  }),
  mediaSourcesQueryOptions: () => ({ queryKey: ['sources'] }),
  mediaSegmentsQueryOptions: (options: { itemId?: string }) => {
    state.segmentOptions(options);
    return { queryKey: ['segments', options.itemId ?? 'none'] };
  },
  streamInfoQueryOptions: (options: unknown) => {
    state.streamOptions(options);
    return { queryKey: ['stream'], enabled: true };
  },
  episodesBySeasonQueryOptions: () => ({ queryKey: ['episodes'] }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey: [key, id], enabled }: { queryKey: string[]; enabled?: boolean }) => {
    state.events.push(key);
    if (key === 'stream') state.streamEnabled = enabled === true;
    return {
      data:
        key === 'sources'
          ? { mediaSources: state.sources }
          : key === 'item'
            ? id === 'movie'
              ? state.item
              : state.sourceItems[id]
            : key === 'stream'
              ? state.streamInfo
              : key === 'segments'
                ? state.segmentSets[id]
                : undefined,
      isPending: key === 'sources' ? state.sourcesPending : true,
      isFetchedAfterMount: true,
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.events = [];
  state.sourcesPending = false;
  state.streamEnabled = false;
  state.subtitleChoice = undefined;
  state.item = undefined;
  state.sourceItems = {};
  state.segmentSets = {};
  state.server = null;
  state.streamInfo = undefined;
  state.sources = [
    {
      id: 'version',
      defaultSubtitleStreamIndex: 9,
      mediaStreams: [
        { type: 'Subtitle', index: 8, isExternal: true },
        { type: 'Subtitle', index: 9, isExternal: true },
      ],
    } as MediaSource,
  ];
});

const useQueries = (
  choice: Partial<Parameters<typeof usePlayerQueries>[0]['streamInfoKeyOptions']> = {},
  subtitlePrefetchChoice?: { sourceId: string; index: number },
) =>
  usePlayerQueries({
    itemId: 'movie',
    mediaAdapter: {} as Parameters<typeof usePlayerQueries>[0]['mediaAdapter'],
    currentServer: state.server,
    useManualComments: false,
    streamInfoKeyOptions: {
      enableTranscoding: false,
      maxBitrate: 20_000_000,
      enableSubtitleBurnIn: false,
      selectedCodec: 'h264',
      ...choice,
    },
    streamDeviceProfile: {},
    streamDeviceId: 'test',
    playbackAttempt: 0,
    preferences: { audioLanguage: 'auto', subtitleLanguage: 'auto', subtitlesEnabled: true },
    subtitlePrefetchChoice,
  });

it('warms the server default before stream negotiation finishes on direct player entry', () => {
  expect(useQueries().streamInfo).toBeUndefined();
  expect(state.prefetch).toHaveBeenCalledWith('movie', state.sources[0], 9);
  expect(state.events.indexOf('prefetch')).toBeLessThan(state.events.indexOf('stream'));
});

it('scopes automatic playback to the same version as the detail playback menu', () => {
  useQueries();
  expect(state.streamOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      keyOptions: expect.objectContaining({ mediaSourceId: 'version' }),
    }),
  );
});

it.each([-1, 0])(
  'scopes subtitle selection %s to a media source on direct player entry',
  (index) => {
    useQueries({ subtitleStreamIndex: index });
    expect(state.streamOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        keyOptions: expect.objectContaining({
          mediaSourceId: 'version',
          subtitleStreamIndex: index,
        }),
      }),
    );
  },
);

it('waits for the source before allocating an automatic playback session', () => {
  state.sourcesPending = true;
  state.sources = [];
  useQueries();
  expect(state.streamEnabled).toBe(false);
  state.sourcesPending = false;
  state.sources = [{ id: 'version', mediaStreams: [] } as unknown as MediaSource];
  useQueries();
  expect(state.streamEnabled).toBe(true);
});

it('starts an explicitly selected version while optional track metadata is loading', () => {
  state.sourcesPending = true;
  useQueries({ mediaSourceId: 'version', subtitleStreamIndex: -1 });
  expect(state.streamEnabled).toBe(true);
});

it('keeps prefetch scoped to the selected video version and subtitle', () => {
  const version = {
    id: 'another-version',
    mediaStreams: [{ type: 'Subtitle', index: 12, isExternal: true }],
  } as MediaSource;
  state.sources.push(version);
  useQueries({ mediaSourceId: version.id, subtitleStreamIndex: 12 });
  expect(state.prefetch).toHaveBeenCalledWith('movie', version, 12);
});

it('does not resolve subtitle off back to the server default', () => {
  useQueries({ mediaSourceId: 'version', subtitleStreamIndex: -1 });
  expect(state.prefetch).toHaveBeenCalledWith('movie', state.sources[0], -1);
});

it('prefetches a menu choice made before video load without changing stream negotiation', () => {
  useQueries({}, { sourceId: 'version', index: 8 });
  expect(state.prefetch).toHaveBeenCalledWith('movie', state.sources[0], 8);
  useQueries({}, { sourceId: 'different-version', index: 8 });
  expect(state.prefetch).toHaveBeenLastCalledWith('movie', state.sources[0], 9);
  useQueries({}, { sourceId: 'version', index: -1 });
  expect(state.prefetch).toHaveBeenLastCalledWith('movie', state.sources[0], -1);
});

it('keeps the player renderable before source metadata arrives', () => {
  state.sources = [];
  expect(() => useQueries()).not.toThrow();
  expect(state.prefetch).toHaveBeenLastCalledWith('movie', undefined, undefined);
  expect(state.streamEnabled).toBe(true);
});

it('uses a remembered subtitle for both negotiation and prefetch on the next item', () => {
  state.subtitleChoice = {
    mode: 'track',
    title: 'big5',
    codec: 'ass',
    forced: false,
    external: true,
  };
  state.sources[0].mediaStreams[0] = {
    type: 'Subtitle',
    index: 8,
    title: 'Big5',
    codec: 'ass',
    isExternal: true,
  };
  useQueries();
  expect(state.prefetch).toHaveBeenCalledWith('movie', state.sources[0], 8);
  expect(state.streamOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      keyOptions: expect.objectContaining({ mediaSourceId: 'version', subtitleStreamIndex: 8 }),
    }),
  );
});

it('switches Jellyfin segment and chapter queries to the selected file, retaining episode resume data', () => {
  state.server = { id: 'server', userId: 'user', type: 'jellyfin' } as MediaServerInfo;
  state.item = {
    id: 'movie',
    type: 'Episode',
    chapters: [{ name: 'OP', startTimeMs: 0 }],
    userData: { playbackPositionTicks: 400000000 },
  } as MediaItem;
  state.sourceItems.alt = {
    ...state.item,
    id: 'alt',
    chapters: [{ name: 'OP', startTimeMs: 20000 }],
    userData: { playbackPositionTicks: 0 },
  };
  state.segmentSets.alt = [{ type: 'Intro', startTimeMs: 20000, endTimeMs: 110000 }];
  const selected = useQueries({ mediaSourceId: 'alt' });
  expect(state.segmentOptions).toHaveBeenLastCalledWith(expect.objectContaining({ itemId: 'alt' }));
  expect(selected.segmentChapters).toBe(state.sourceItems.alt.chapters);
  expect(selected.mediaSegments).toBe(state.segmentSets.alt);
  expect(selected.itemDetail).toBe(state.item);

  const pending = useQueries({ mediaSourceId: 'another-version' });
  expect(pending.segmentChapters).toEqual([]);
  expect(pending.mediaSegments).toEqual([]);
  expect(pending.itemDetail?.userData?.playbackPositionTicks).toBe(400000000);
});

it('uses the negotiated Jellyfin resource ID and does not apply a primary source chapter fallback', () => {
  state.server = { id: 'server', userId: 'user', type: 'jellyfin' } as MediaServerInfo;
  state.item = { id: 'movie', chapters: [{ name: 'OP', startTimeMs: 0 }] } as MediaItem;
  state.streamInfo = { mediaSource: { Id: 'negotiated-version' } };
  const selected = useQueries();
  expect(state.segmentOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ itemId: 'negotiated-version' }),
  );
  expect(selected.segmentChapters).toEqual([]);
});

it('keeps the main Emby file chapters but never guesses item IDs from opaque alternate source IDs', () => {
  state.server = { id: 'server', userId: 'user', type: 'emby' } as MediaServerInfo;
  state.item = { id: 'movie', chapters: [{ name: 'OP', startTimeMs: 0 }] } as MediaItem;
  expect(useQueries().segmentChapters).toBe(state.item.chapters);
  expect(useQueries({ mediaSourceId: 'opaque-alternate' }).segmentChapters).toEqual([]);
  expect(state.segmentOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ itemId: 'movie' }),
  );
});
