import type { MediaSource } from '@/services/media/types';
import { beforeEach, expect, it, vi } from 'vitest';

import { usePlayerQueries } from './usePlayerQueries';

const state = vi.hoisted(() => ({
  sources: [] as MediaSource[],
  prefetch: vi.fn(),
  events: [] as string[],
  sourcesPending: false,
  streamOptions: vi.fn(),
  streamEnabled: false,
}));
vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }));
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
  playbackItemDetailQueryOptions: () => ({ queryKey: ['item'] }),
  mediaSourcesQueryOptions: () => ({ queryKey: ['sources'] }),
  mediaSegmentsQueryOptions: () => ({ queryKey: ['segments'] }),
  streamInfoQueryOptions: (options: unknown) => {
    state.streamOptions(options);
    return { queryKey: ['stream'], enabled: true };
  },
  episodesBySeasonQueryOptions: () => ({ queryKey: ['episodes'] }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey: [key], enabled }: { queryKey: string[]; enabled?: boolean }) => {
    state.events.push(key);
    if (key === 'stream') state.streamEnabled = enabled === true;
    return {
      data: key === 'sources' ? { mediaSources: state.sources } : undefined,
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
    currentServer: null,
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
