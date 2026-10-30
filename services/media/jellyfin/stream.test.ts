import { describe, expect, it, vi } from 'vitest';

import { getDownloadUrl, getPlaybackUrl, getStreamInfo } from './stream';

const { playbackInfo } = vi.hoisted(() => ({ playbackInfo: vi.fn() }));
vi.mock('@jellyfin/sdk/lib/utils/api', () => ({
  getMediaInfoApi: () => ({ getPlaybackInfo: playbackInfo }),
}));

describe('Jellyfin stream urls', () => {
  const api = {
    basePath: 'https://jellyfin.test',
    accessToken: 'token-1',
    deviceInfo: {
      id: 'device-1',
    },
  } as never;

  it('builds direct play urls from explicit stream params', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const url = getPlaybackUrl(api, 'item-1', { Id: 'source-1' } as never, {
      userId: 'user-1',
      startTimeTicks: 1000,
      maxStreamingBitrate: 2000,
      audioStreamIndex: 1,
      subtitleStreamIndex: -1,
      playSessionId: 'session-1',
    });

    expect(url).toBe(
      'https://jellyfin.test/Videos/item-1/stream?static=true&container=mp4&mediaSourceId=source-1&subtitleStreamIndex=-1&audioStreamIndex=1&deviceId=device-1&api_key=token-1&startTimeTicks=1000&maxStreamingBitrate=2000&userId=user-1&playSessionId=session-1',
    );

    consoleSpy.mockRestore();
  });

  it('uses transcoding urls and adjusts disabled subtitle handling', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(
      getPlaybackUrl(
        api,
        'item-1',
        {
          TranscodingUrl: '/videos/item-1/master.m3u8?SubtitleMethod=Encode',
        } as never,
        {
          userId: 'user-1',
          subtitleStreamIndex: -1,
        },
      ),
    ).toBe('https://jellyfin.test/videos/item-1/master.m3u8?SubtitleMethod=Hls');

    consoleSpy.mockRestore();
  });

  it('adds download stream params for direct-play media', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = getDownloadUrl(api, 'item-1', { Id: 'source-1' } as never, 'session-1', {
      userId: 'user-1',
    });

    expect(result.url).toContain('https://jellyfin.test/Videos/item-1/stream?');
    expect(result.url).toContain('container=ts');
    expect(result.url).toContain('subtitleMethod=Embed');
    expect(result.url).toContain('allowVideoStreamCopy=true');
    expect(result.sessionId).toBe('session-1');

    consoleSpy.mockRestore();
  });

  it('returns null when required stream info inputs are missing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      getStreamInfo({
        api,
        item: undefined,
        userId: 'user-1',
        startTimeTicks: 0,
        deviceProfile: {},
      }),
    ).resolves.toBeNull();

    consoleSpy.mockRestore();
  });

  it('sends subtitle burn-in and lets Jellyfin choose the default audio stream', async () => {
    playbackInfo.mockResolvedValue({
      status: 200,
      data: {
        PlaySessionId: 'negotiated-session',
        MediaSources: [{ Id: 'source-1' }],
      },
    });
    const result = await getStreamInfo({
      api,
      item: { Id: 'item-1' },
      userId: 'user-1',
      startTimeTicks: 0,
      deviceProfile: {},
      alwaysBurnInSubtitleWhenTranscoding: true,
    });
    expect(playbackInfo.mock.lastCall?.[1].data).toMatchObject({
      alwaysBurnInSubtitleWhenTranscoding: true,
    });
    expect(playbackInfo.mock.lastCall?.[1].data.audioStreamIndex).toBeUndefined();
    expect(new URL(result!.url!).searchParams.get('playSessionId')).toBe('negotiated-session');
  });

  it('uses the requested media source rather than the first version', async () => {
    playbackInfo.mockResolvedValue({
      status: 200,
      data: {
        PlaySessionId: 'session',
        MediaSources: [{ Id: 'wrong' }, { Id: 'chosen' }],
      },
    });
    const result = await getStreamInfo({
      api,
      item: { Id: 'item-1' },
      userId: 'user-1',
      startTimeTicks: 0,
      deviceProfile: {},
      mediaSourceId: 'chosen',
    });
    expect(result?.mediaSource?.Id).toBe('chosen');
  });

  it.each([
    { ErrorCode: 'NoCompatibleStream', MediaSources: [{ Id: 'chosen' }] },
    { MediaSources: [] },
    { MediaSources: [{ Id: 'another-version' }] },
  ])('rejects unsuccessful negotiation before building a playback URL: %j', async (data) => {
    playbackInfo.mockResolvedValue({ status: 200, data });
    await expect(
      getStreamInfo({
        api,
        item: { Id: 'item-1' },
        userId: 'user-1',
        startTimeTicks: 0,
        deviceProfile: {},
        mediaSourceId: 'chosen',
        audioStreamIndex: 2,
        subtitleStreamIndex: 5,
      }),
    ).rejects.toThrow();
  });
});
