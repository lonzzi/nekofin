import type { ExpoMpvViewRef, TrackInfo } from 'expo-mpv';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createExternalTrackRequestCache,
  externalTrackRequestKey,
  isExternalTrackCommandError,
  loadExternalPlayerTrack,
  loadExternalTracksProgressively,
  selectPlayerSubtitleTrack,
} from './playerTrackLoading';

describe('external track attempts across effect restarts', () => {
  it('retains a failed attempt until the user explicitly retries', async () => {
    const cache = createExternalTrackRequestCache();
    const start = vi.fn(async (): Promise<number> => {
      throw new Error('HTTP 503');
    });
    await expect(cache.load('sub:8', start)).rejects.toThrow('HTTP 503');
    await expect(cache.load('sub:8', start)).rejects.toThrow('HTTP 503');
    expect(start).toHaveBeenCalledOnce();

    cache.retry('sub:8');
    await expect(cache.load('sub:8', start)).rejects.toThrow('HTTP 503');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does not replace in-flight or successful loads when selecting a subtitle again', async () => {
    const cache = createExternalTrackRequestCache();
    let finish!: (id: number) => void;
    const start = vi.fn(() => new Promise<number>((resolve) => (finish = resolve)));
    const request = cache.load('sub:8', start);
    await Promise.resolve();
    cache.retry('sub:8');
    expect(cache.load('sub:8', start)).toBe(request);
    finish(7);
    await expect(request).resolves.toBe(7);
    cache.retry('sub:8');
    await expect(cache.load('sub:8', start)).resolves.toBe(7);
    expect(start).toHaveBeenCalledOnce();
  });

  it('lets other tracks load and scopes retries to the exact type, index and URL', async () => {
    const cache = createExternalTrackRequestCache();
    const track = { index: 8, name: 'Chinese', url: 'https://media.test/sub.srt' };
    const key = externalTrackRequestKey('sub', track);
    const failed = vi.fn(async (): Promise<number> => {
      throw new Error('HTTP 404');
    });
    const good = vi.fn(async () => 9);
    await expect(cache.load(key, failed)).rejects.toThrow('HTTP 404');
    const otherKey = externalTrackRequestKey('audio', track);
    await expect(cache.load(otherKey, good)).resolves.toBe(9);
    cache.retry(otherKey);
    cache.retry(externalTrackRequestKey('sub', { ...track, url: 'https://media.test/new.srt' }));
    await expect(cache.load(key, failed)).rejects.toThrow('HTTP 404');
    expect(failed).toHaveBeenCalledOnce();
    await expect(cache.load(otherKey, good)).resolves.toBe(9);
    expect(good).toHaveBeenCalledOnce();
  });
});

describe('native subtitle selection confirmation', () => {
  const createPlayer = () => ({
    setSubtitleTrack: vi.fn().mockResolvedValue(undefined),
    setPropertyString: vi.fn().mockResolvedValue(undefined),
    getCurrentTrackIds: vi.fn().mockResolvedValue({ vid: 1, aid: 2, sid: 7 }),
  });

  it('confirms the native subtitle ID before reporting success', async () => {
    const player = createPlayer();
    await expect(selectPlayerSubtitleTrack(player, 7, () => true)).resolves.toEqual({
      vid: 1,
      aid: 2,
      sid: 7,
    });
    expect(player.setSubtitleTrack).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('propagates a rejected embedded switch so its pending choice can be cleared', async () => {
    const player = createPlayer();
    const error = new Error('Unsupported subtitle stream');
    player.setSubtitleTrack.mockRejectedValue(error);
    await expect(selectPlayerSubtitleTrack(player, 7, () => true)).rejects.toBe(error);
    expect(player.getCurrentTrackIds).not.toHaveBeenCalled();
  });

  it.each([7, -1])(
    'rejects a switch to %s that resolves without changing the native sid',
    async (trackId) => {
      const player = createPlayer();
      player.getCurrentTrackIds.mockResolvedValue({ vid: 1, aid: 2, sid: 3 });
      await expect(selectPlayerSubtitleTrack(player, trackId, () => true)).rejects.toThrow(
        'Subtitle selection was not confirmed',
      );
    },
  );

  it('propagates a failed confirmation read', async () => {
    const player = createPlayer();
    player.getCurrentTrackIds.mockRejectedValue(new Error('Player unavailable'));
    await expect(selectPlayerSubtitleTrack(player, 7, () => true)).rejects.toThrow(
      'Player unavailable',
    );
  });

  it.each([0, -1])('accepts disabled subtitles reported as sid=%s', async (sid) => {
    const player = createPlayer();
    player.getCurrentTrackIds.mockResolvedValue({ vid: 1, aid: 2, sid });
    await expect(selectPlayerSubtitleTrack(player, -1, () => true)).resolves.toMatchObject({
      sid,
    });
    expect(player.setPropertyString).toHaveBeenCalledExactlyOnceWith('sid', 'no');
    expect(player.setSubtitleTrack).not.toHaveBeenCalled();
  });

  it('discards a confirmation when a newer choice or source supersedes it', async () => {
    const player = createPlayer();
    let active = false;
    await expect(selectPlayerSubtitleTrack(player, 7, () => active)).resolves.toBeUndefined();
    expect(player.setSubtitleTrack).not.toHaveBeenCalled();
    active = true;
    player.getCurrentTrackIds.mockImplementation(async () => {
      active = false;
      return { vid: 1, aid: 2, sid: 7 };
    });
    await expect(selectPlayerSubtitleTrack(player, 7, () => active)).resolves.toBeUndefined();
  });
});

describe('external native track loading', () => {
  afterEach(() => vi.useRealTimers());

  it('shows embedded tracks immediately and publishes a loaded track while later downloads wait', async () => {
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = vi.fn(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    const second = vi.fn(() => new Promise<void>((resolve) => (finishSecond = resolve)));
    const refresh = vi.fn(async () => {});
    const loading = loadExternalTracksProgressively([first, second], refresh, () => true);
    await vi.waitFor(() => expect(first).toHaveBeenCalledOnce());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    finishFirst();
    await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
    expect(refresh).toHaveBeenCalledTimes(2);
    finishSecond();
    await expect(loading).resolves.toEqual({ failed: false });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('keeps usable tracks visible and continues after an external download fails', async () => {
    const refresh = vi.fn(async () => {});
    const later = vi.fn(async () => {});
    await expect(
      loadExternalTracksProgressively(
        [
          async () => {
            throw new Error('HTTP 503');
          },
          later,
        ],
        refresh,
        () => true,
      ),
    ).resolves.toEqual({ failed: true });
    expect(later).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('does not publish a stale load or start more downloads after leaving playback', async () => {
    let active = true;
    const later = vi.fn(async () => {});
    const refresh = vi.fn(async () => {});
    await expect(
      loadExternalTracksProgressively(
        [
          async () => {
            active = false;
          },
          later,
        ],
        refresh,
        () => active,
      ),
    ).resolves.toBeUndefined();
    expect(refresh).toHaveBeenCalledOnce();
    expect(later).not.toHaveBeenCalled();
    await expect(
      loadExternalTracksProgressively([later], refresh, () => false),
    ).resolves.toBeUndefined();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('distinguishes optional track command failures from fatal video errors', () => {
    expect(isExternalTrackCommandError("Command 'sub-add' failed: error running command")).toBe(
      true,
    );
    expect(isExternalTrackCommandError("Command 'audio-add' failed: loading failed")).toBe(true);
    expect(isExternalTrackCommandError("Command 'loadfile' failed: loading failed")).toBe(false);
    expect(isExternalTrackCommandError('Failed to open media')).toBe(false);
  });

  it('waits for asynchronous mpv track discovery without selecting the first external track', async () => {
    vi.useFakeTimers();
    const embedded = { id: 1, type: 'sub' } as TrackInfo;
    const external = { id: 7, type: 'sub', isExternal: true } as TrackInfo;
    const player = {
      getTrackList: vi
        .fn()
        .mockResolvedValueOnce([embedded])
        .mockResolvedValueOnce([embedded])
        .mockResolvedValue([embedded, external]),
      addSubtitle: vi.fn().mockResolvedValue(undefined),
      addAudio: vi.fn(),
    };
    const promise = loadExternalPlayerTrack(
      player as unknown as ExpoMpvViewRef,
      'sub',
      { index: 5, name: 'Chinese', language: 'zh', url: 'https://media.test/sub.srt' },
      () => true,
    );
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(7);
    expect(player.addSubtitle).toHaveBeenCalledWith(
      'https://media.test/sub.srt',
      'auto',
      'Chinese',
      'zh',
    );
    expect(player.getTrackList).toHaveBeenCalledTimes(3);
  });

  it('discards work after the native source was replaced', async () => {
    const player = { getTrackList: vi.fn(async () => []), addSubtitle: vi.fn(), addAudio: vi.fn() };
    await expect(
      loadExternalPlayerTrack(
        player,
        'audio',
        { index: 2, name: 'Commentary', url: 'https://media.test/audio.mka' },
        () => false,
      ),
    ).resolves.toBeUndefined();
    expect(player.addAudio).not.toHaveBeenCalled();
  });

  it('serializes native adds when a menu choice overtakes a background download', async () => {
    vi.useFakeTimers();
    const tracks = [{ id: 1, type: 'sub' }] as TrackInfo[];
    let finishFirst!: () => void;
    const player = {
      getTrackList: vi.fn(async () => [...tracks]),
      addSubtitle: vi.fn(async (_url: string, _flag?: string, name?: string) => {
        if (name === 'background') await new Promise<void>((resolve) => (finishFirst = resolve));
        tracks.push({
          id: name === 'background' ? 3 : 7,
          type: 'sub',
          isExternal: true,
        } as TrackInfo);
      }),
      addAudio: vi.fn(),
    };
    const background = loadExternalPlayerTrack(
      player,
      'sub',
      { index: 8, name: 'background', url: 'file:///background.ass' },
      () => true,
    );
    await vi.advanceTimersByTimeAsync(0);
    const chosen = loadExternalPlayerTrack(
      player,
      'sub',
      { index: 12, name: 'chosen', url: 'file:///chosen.ass' },
      () => true,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(player.addSubtitle).toHaveBeenCalledTimes(1);
    finishFirst();
    await vi.runAllTimersAsync();
    expect(await background).toBe(3);
    expect(await chosen).toBe(7);
  });
});
