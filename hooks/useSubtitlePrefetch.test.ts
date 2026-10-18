import type { MediaSource } from '@/services/media/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubtitlePrefetch } from './useSubtitlePrefetch';

const state = vi.hoisted(() => ({
  focused: true,
  pathname: '/movie/movie',
  playerItemId: undefined as string | undefined,
  cleanup: undefined as (() => void) | undefined,
  prepare: vi.fn(),
  dispose: vi.fn(),
  createCache: vi.fn(),
}));

vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    state.cleanup = effect();
  },
}));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useGlobalSearchParams: () => ({ itemId: state.playerItemId }),
}));
vi.mock('expo-router/react-navigation', () => ({ useIsFocused: () => state.focused }));
vi.mock('@/lib/contexts/MediaServerContext', () => ({
  useMediaServers: () => ({
    currentServer: { id: 'server', userId: 'user' },
    currentApi: { basePath: 'https://media.test', accessToken: 'test-only' },
  }),
}));
vi.mock('@/services/media/subtitleCache', () => ({
  createExternalSubtitleCache: (...args: unknown[]) => state.createCache(...args),
}));

const source = {
  id: 'version',
  size: 123,
  mediaStreams: [
    { index: 4, type: 'Subtitle', isExternal: false, codec: 'ass' },
    { index: 8, type: 'Subtitle', isExternal: true, codec: 'ass' },
    { index: 9, type: 'Subtitle', isExternal: true, codec: 'ass' },
  ],
} as MediaSource;

describe('selected subtitle prefetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.focused = true;
    state.pathname = '/movie/movie';
    state.playerItemId = undefined;
    state.cleanup = undefined;
    state.prepare.mockResolvedValue(undefined);
    state.createCache.mockReturnValue({ prepare: state.prepare, dispose: state.dispose });
  });

  it('warms only the selected variant instead of downloading every large ASS file', async () => {
    useSubtitlePrefetch('movie', source, 9);
    expect(state.prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ index: 9 }),
      expect.any(Function),
    );
    expect(state.createCache).toHaveBeenCalledWith({
      serverId: 'server',
      userId: 'user',
      itemId: 'movie',
      mediaSourceId: 'version',
      sourceSize: 123,
    });
    await vi.waitFor(() => expect(state.dispose).toHaveBeenCalledOnce());
  });

  it.each([-1, undefined, 4, 99])(
    'does not warm disabled, unresolved or embedded track %s',
    (index) => {
      useSubtitlePrefetch('movie', source, index);
      expect(state.prepare).not.toHaveBeenCalled();
      expect(state.createCache).not.toHaveBeenCalled();
    },
  );

  it('keeps a pending request active during handoff to the same item player', () => {
    state.focused = false;
    state.pathname = '/player';
    state.playerItemId = 'movie';
    state.prepare.mockReturnValue(new Promise(() => {}));
    useSubtitlePrefetch('movie', source, 8);
    const isActive = state.prepare.mock.calls[0][1];
    expect(isActive()).toBe(true);
    expect(state.dispose).not.toHaveBeenCalled();
    state.cleanup?.();
    expect(isActive()).toBe(false);
    expect(state.dispose).toHaveBeenCalledOnce();
  });

  it('does not warm a background detail page for another playing item', () => {
    state.focused = false;
    state.pathname = '/player';
    state.playerItemId = 'another-movie';
    useSubtitlePrefetch('movie', source, 8);
    expect(state.prepare).not.toHaveBeenCalled();
  });

  it('releases a failed prefetch so playback can retry it', async () => {
    state.prepare.mockRejectedValue(new Error('HTTP 503'));
    useSubtitlePrefetch('movie', source, 8);
    await vi.waitFor(() => expect(state.dispose).toHaveBeenCalledOnce());
  });
});
