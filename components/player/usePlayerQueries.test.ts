import type { MediaSource } from '@/services/media/types';
import { beforeEach, expect, it, vi } from 'vitest';

import { usePlayerQueries } from './usePlayerQueries';

const state = vi.hoisted(() => ({
  sources: [] as MediaSource[],
  prefetch: vi.fn(),
  events: [] as string[],
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
  streamInfoQueryOptions: () => ({ queryKey: ['stream'], enabled: true }),
  episodesBySeasonQueryOptions: () => ({ queryKey: ['episodes'] }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey: [key] }: { queryKey: string[] }) => {
    state.events.push(key);
    return {
      data: key === 'sources' ? { mediaSources: state.sources } : undefined,
      isPending: key !== 'sources',
      isFetchedAfterMount: true,
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.events = [];
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
});
