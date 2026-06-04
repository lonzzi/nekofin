import { describe, expect, it } from 'vitest';

import { mapJellyfinPlaybackInfo } from './playback';

describe('Jellyfin playback helpers', () => {
  it('maps playback media sources into the adapter contract', () => {
    expect(
      mapJellyfinPlaybackInfo({
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

  it('falls back to an empty media source list', () => {
    expect(mapJellyfinPlaybackInfo(undefined)).toEqual({ mediaSources: [] });
  });
});
