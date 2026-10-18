import { expect, it } from 'vitest';

import { deriveExternalSubtitles, prioritizeSubtitleTracks } from './externalTracks';

it.each(['pgs', 'pgssub', 'HDMV_PGS_SUBTITLE', 'sup'])(
  'requests raw SUP for external %s when the server omits DeliveryUrl',
  (Codec) => {
    const tracks = deriveExternalSubtitles(
      [{ Type: 'Subtitle', IsExternal: true, Codec, Index: 4 }],
      'https://media.example/jellyfin',
      { itemId: 'film', mediaSourceId: 'source', accessToken: 'test-token' },
    );
    expect(tracks[0].url).toBe(
      'https://media.example/jellyfin/Videos/film/source/Subtitles/4/0/Stream.sup?api_key=test-token',
    );
  },
);

it('preserves a server-provided PGS URL and excludes burned-in subtitles', () => {
  const tracks = deriveExternalSubtitles(
    [
      {
        Type: 'Subtitle',
        Codec: 'pgssub',
        Index: 4,
        DeliveryMethod: 'External',
        DeliveryUrl: '/Subtitles/original.pgs',
      },
      { Type: 'Subtitle', Codec: 'pgssub', Index: 5, IsExternal: true, DeliveryMethod: 'Encode' },
    ],
    'https://media.example',
    { itemId: 'film', mediaSourceId: 'source' },
  );
  expect(tracks.map((track) => track.url)).toEqual([
    'https://media.example/Subtitles/original.pgs',
  ]);
});

it('loads the selected subtitle before other tracks without mutating server order', () => {
  const tracks = [{ index: 1 }, { index: 2 }, { index: 3 }];
  expect(prioritizeSubtitleTracks(tracks, 3).map((track) => track.index)).toEqual([3, 1, 2]);
  expect(tracks.map((track) => track.index)).toEqual([1, 2, 3]);
  expect(prioritizeSubtitleTracks(tracks, -1)).toEqual(tracks);
  expect(prioritizeSubtitleTracks(tracks, 99)).toEqual(tracks);
});
