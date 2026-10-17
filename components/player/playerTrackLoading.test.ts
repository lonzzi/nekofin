import type { ExpoMpvViewRef, TrackInfo } from 'expo-mpv';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isExternalTrackCommandError,
  loadExternalPlayerTrack,
  loadExternalTracksProgressively,
} from './playerTrackLoading';

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
});
