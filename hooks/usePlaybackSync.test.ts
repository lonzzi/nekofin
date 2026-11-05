import { mediaQueryKeys } from '@/services/media/queryKeys';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePlaybackSync } from './usePlaybackSync';

const state = vi.hoisted(() => ({
  client: null as unknown as QueryClient,
  reportStart: vi.fn<() => Promise<void>>(),
  reportStop: vi.fn<() => Promise<void>>(),
}));

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
}));
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => state.client,
}));
vi.mock('./useMediaAdapter', () => ({
  useMediaAdapter: () => ({
    reportPlaybackStart: state.reportStart,
    reportPlaybackStop: state.reportStop,
  }),
}));

const props = {
  currentServer: { id: 'server-1', userId: 'user-1' },
  itemDetail: {
    id: 'episode-1',
    name: 'Episode 1',
    type: 'Episode',
    seriesId: 'series-1',
    seasonId: 'season-1',
    raw: {},
  },
  currentTime: { value: 120_000 },
  playSessionId: 'session-1',
} as Parameters<typeof usePlaybackSync>[0];
const seriesKey = mediaQueryKeys.itemDetail('server-1', 'series-1', 'user-1');

beforeEach(() => {
  state.client = new QueryClient();
  state.client.setQueryData(seriesKey, { userData: { played: false } });
  state.reportStop.mockReset();
  state.reportStart.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  state.client.clear();
  vi.restoreAllMocks();
});

describe('playback stop watched state refresh', () => {
  it('hands the current episode and position back before the server acknowledges stopping', async () => {
    let acknowledge!: () => void;
    state.reportStop.mockReturnValue(new Promise<void>((resolve) => (acknowledge = resolve)));
    const playback = usePlaybackSync(props);
    playback.syncPlaybackStart(0);
    playback.syncPlaybackStop(45_000);
    expect(
      state.client.getQueryData(mediaQueryKeys.playbackEpisode('server-1', 'user-1', 'series-1')),
    ).toMatchObject({
      item: { id: 'episode-1', userData: { playbackPositionTicks: 450_000_000 } },
    });
    expect(state.client.getQueryState(seriesKey)?.isInvalidated).toBe(false);
    acknowledge();
    await vi.waitFor(() => expect(state.client.getQueryState(seriesKey)?.isInvalidated).toBe(true));
  });

  it('does not refetch a new active episode when the previous episode stop arrives late', async () => {
    let acknowledge!: () => void;
    state.reportStop.mockReturnValue(new Promise<void>((resolve) => (acknowledge = resolve)));
    usePlaybackSync(props).syncPlaybackStop(120_000);

    // Episode B mounts while episode A's stop request is still pending.
    const nextKey = mediaQueryKeys.itemDetail('server-1', 'episode-2', 'user-1');
    const posterKey = mediaQueryKeys.homeLatest('server-1', 'anime');
    const nextItem = { id: 'episode-2', userData: { playbackPositionTicks: 450_000 } };
    state.client.setQueryData(nextKey, nextItem);
    state.client.setQueryData(posterKey, []);
    const fetchNextItem = vi.fn(async () => ({
      ...nextItem,
      userData: { playbackPositionTicks: 0 },
    }));
    const observer = new QueryObserver(state.client, {
      queryKey: nextKey,
      queryFn: fetchNextItem,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      expect(fetchNextItem).not.toHaveBeenCalled();
      acknowledge();
      await vi.waitFor(() => {
        expect(state.client.getQueryState(posterKey)?.isInvalidated).toBe(true);
      });
      expect(fetchNextItem).not.toHaveBeenCalled();
      expect(state.client.getQueryData(nextKey)).toBe(nextItem);
      expect(state.client.getQueryState(nextKey)?.isInvalidated).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it('waits for the server to acknowledge playback before invalidating the parent series', async () => {
    let acknowledge!: () => void;
    state.reportStop.mockReturnValue(new Promise<void>((resolve) => (acknowledge = resolve)));
    const { syncPlaybackStop } = usePlaybackSync(props);
    syncPlaybackStop(120_000);

    expect(state.reportStop).toHaveBeenCalledWith({
      itemId: 'episode-1',
      positionTicks: 120_000,
      mediaSourceId: undefined,
      PlaySessionId: 'session-1',
    });
    expect(state.client.getQueryState(seriesKey)?.isInvalidated).toBe(false);
    acknowledge();
    await vi.waitFor(() => {
      expect(state.client.getQueryState(seriesKey)?.isInvalidated).toBe(true);
    });
  });

  it('keeps cached completion unchanged when the server rejects the stop report', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    state.reportStop.mockRejectedValue(new Error('timeout'));
    usePlaybackSync(props).syncPlaybackStop(120_000);
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('[PlaybackSync] stop report failed'));
    expect(state.client.getQueryState(seriesKey)?.isInvalidated).toBe(false);
  });
});
