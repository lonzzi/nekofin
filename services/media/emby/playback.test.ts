import { describe, expect, it } from 'vitest';

import { buildEmbyStreamUrl, mapEmbyPlaybackInfo } from './playback';

describe('Emby playback helpers', () => {
  it('maps playback media sources into the adapter contract', () => {
    expect(
      mapEmbyPlaybackInfo({
        MediaSources: [
          {
            Id: 'source-1',
            Protocol: 'File',
            Container: 'mkv',
            Size: 1000,
            Bitrate: 2000,
            MediaStreams: [
              {
                Codec: 'h264',
                Type: 'Video',
                Index: 0,
                Width: 1920,
                Height: 1080,
              },
              {
                Codec: 'aac',
                Type: 'Audio',
                Index: 1,
                Language: 'jpn',
                IsDefault: true,
              },
            ],
          },
        ],
      }),
    ).toEqual({
      mediaSources: [
        {
          id: 'source-1',
          protocol: 'File',
          container: 'mkv',
          size: 1000,
          bitrate: 2000,
          mediaStreams: [
            expect.objectContaining({
              codec: 'h264',
              type: 'Video',
              index: 0,
              width: 1920,
              height: 1080,
            }),
            expect.objectContaining({
              codec: 'aac',
              type: 'Audio',
              index: 1,
              language: 'jpn',
              isDefault: true,
            }),
          ],
        },
      ],
    });
  });

  it('builds direct play stream urls from explicit params', () => {
    expect(
      buildEmbyStreamUrl({
        api: {
          basePath: 'https://emby.test',
          accessToken: 'token-1',
        },
        itemId: 'item-1',
        mediaSource: {
          Id: 'source-1',
        },
        userId: 'user-1',
        startTimeTicks: 1000,
        maxStreamingBitrate: 2000,
        playSessionId: 'session-1',
        audioStreamIndex: 1,
        subtitleStreamIndex: -1,
        deviceId: 'device-1',
      }),
    ).toBe(
      'https://emby.test/Videos/item-1/stream?static=true&container=mp4&mediaSourceId=source-1&subtitleStreamIndex=-1&audioStreamIndex=1&deviceId=device-1&api_key=token-1&startTimeTicks=1000&maxStreamingBitrate=2000&userId=user-1&playSessionId=session-1',
    );
  });

  it('uses provider transcoding urls when present', () => {
    expect(
      buildEmbyStreamUrl({
        api: {
          basePath: 'https://emby.test',
          accessToken: 'token-1',
        },
        itemId: 'item-1',
        mediaSource: {
          TranscodingUrl: '/Videos/item-1/master.m3u8',
        },
        userId: 'user-1',
      }),
    ).toBe('https://emby.test/Videos/item-1/master.m3u8');
  });
});
