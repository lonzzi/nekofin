import { generateDeviceProfile } from '@/lib/profiles/native';
import { describe, expect, it, vi } from 'vitest';

import { applyPlaybackQuality } from './playbackQuality';
import { parsePlaybackSelection, playbackSelectionParams } from './playbackSelection';
import { streamInfoQueryOptions } from './queryOptions';
import type { MediaAdapter, MediaServerInfo } from './types';

const defaults = {
  enableTranscoding: false,
  maxBitrate: 20000000,
  enableSubtitleBurnIn: false,
  selectedCodec: 'h265',
};

describe('per-playback quality', () => {
  it('defaults to Auto and preserves existing global playback settings', () => {
    for (const enableTranscoding of [true, false]) {
      const settings = { ...defaults, enableTranscoding };
      expect(applyPlaybackQuality(undefined, settings)).toEqual(settings);
      expect(applyPlaybackQuality('auto', settings)).toEqual(settings);
    }
  });

  it('validates quality route parameters and carries an explicit Auto choice', () => {
    for (const quality of ['1000000', 'auto'] as const) {
      expect(parsePlaybackSelection(playbackSelectionParams({ quality })).quality).toBe(quality);
    }
    for (const quality of ['', '0', '-1', '1e6', '1.5', '999999999', ['1000000']]) {
      expect(parsePlaybackSelection({ quality }).quality).toBeUndefined();
    }
  });

  it('passes the chosen cap to the device profile and server without altering global defaults', async () => {
    const selection = parsePlaybackSelection({ quality: '1000000' });
    const settings = applyPlaybackQuality(selection.quality, defaults);
    const profile = generateDeviceProfile({
      transcode: settings.enableTranscoding,
      maxBitrate: settings.maxBitrate,
      codec: settings.selectedCodec,
      subtitleBurnIn: settings.enableSubtitleBurnIn,
    });
    const getStreamInfo = vi.fn(async () => null);
    const options = streamInfoQueryOptions({
      adapter: { getStreamInfo } as unknown as MediaAdapter,
      currentServer: { id: 'server', userId: 'user' } as MediaServerInfo,
      item: { id: 'movie', name: 'Movie', type: 'Movie', raw: {} },
      keyOptions: settings,
      deviceProfile: profile,
      deviceId: 'device',
    });
    await options.queryFn!({} as never);
    expect(getStreamInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        maxStreamingBitrate: 1000000,
        deviceProfile: expect.objectContaining({
          MaxStaticBitrate: 1000000,
          MaxStreamingBitrate: 1000000,
        }),
      }),
    );
    expect(profile.TranscodingProfiles[0].VideoCodec).toBe('hevc,h264');
    expect(defaults).toMatchObject({ enableTranscoding: false, maxBitrate: 20000000 });
    const auto = streamInfoQueryOptions({
      adapter: { getStreamInfo } as unknown as MediaAdapter,
      currentServer: { id: 'server', userId: 'user' } as MediaServerInfo,
      item: { id: 'movie', name: 'Movie', type: 'Movie', raw: {} },
      keyOptions: applyPlaybackQuality('auto', defaults),
      deviceProfile: generateDeviceProfile(),
      deviceId: 'device',
    });
    expect(auto.queryKey).not.toEqual(options.queryKey);
    await auto.queryFn!({} as never);
    expect(getStreamInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxStreamingBitrate: undefined }),
    );
  });
});
