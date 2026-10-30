import { mediaQueryKeys } from '@/services/media/queryKeys';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePlaybackSync } from './usePlaybackSync';

const state = vi.hoisted(() => ({
  client: null as unknown as QueryClient,
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
  useMediaAdapter: () => ({ reportPlaybackStop: state.reportStop }),
}));

const props = {
  currentServer: { id: 'server-1' },
  itemDetail: { id: 'episode-1' },
  currentTime: { value: 120_000 },
  playSessionId: 'session-1',
} as Parameters<typeof usePlaybackSync>[0];
const seriesKey = mediaQueryKeys.itemDetail('server-1', 'series-1', 'user-1');

beforeEach(() => {
  state.client = new QueryClient();
  state.client.setQueryData(seriesKey, { userData: { played: false } });
  state.reportStop.mockReset();
});
afterEach(() => {
  state.client.clear();
  vi.restoreAllMocks();
});

describe('playback stop watched state refresh', () => {
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
