import { expect, it } from 'vitest';

import {
  deriveExternalSubtitles,
  prioritizeSubtitleTracks,
  subtitleTracksToLoad,
} from './externalTracks';

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

it('downloads only the selected bitmap stream from a multi-language Blu-ray', () => {
  const streams = Array.from({ length: 30 }, (_, index) => ({
    Type: 'Subtitle',
    Index: index,
    Codec: 'pgssub',
    DeliveryMethod: 'External',
    DeliveryUrl: `/Subtitles/${index}`,
  }));
  streams.push({
    Type: 'Subtitle',
    Index: 40,
    Codec: 'ass',
    DeliveryMethod: 'External',
    DeliveryUrl: '/Subtitles/40',
  });
  const tracks = deriveExternalSubtitles(streams, 'https://media.test');
  expect(subtitleTracksToLoad(tracks, streams, 12).map((track) => track.index)).toEqual([12, 40]);
  expect(subtitleTracksToLoad(tracks, streams, 25).map((track) => track.index)).toEqual([25, 40]);
  for (const selected of [-1, undefined, 999])
    expect(subtitleTracksToLoad(tracks, streams, selected).map((track) => track.index)).toEqual([
      40,
    ]);
  expect(tracks).toHaveLength(31);
});

it.each(['sup', 'pgs', 'pgssub', 'SUP'])(
  'keeps an unselected .%s sidecar on demand when codec metadata is missing',
  (format) => {
    const tracks = [
      { index: 8, url: `https://media.test/Stream.${format}?api_key=test-only` },
      { index: 9, url: 'https://media.test/Stream.srt' },
    ];
    expect(subtitleTracksToLoad(tracks, [], 9)).toEqual([tracks[1]]);
    expect(subtitleTracksToLoad(tracks, [], 8)).toEqual(tracks);
  },
);

it('does not preload opaque subtitle URLs when the server omitted codec metadata', () => {
  const tracks = [
    { index: 8, url: 'https://media.test/Subtitles/8' },
    { index: 9, url: 'https://media.test/Subtitles/9' },
  ];
  expect(subtitleTracksToLoad(tracks, [], 8)).toEqual([tracks[0]]);
  expect(subtitleTracksToLoad(tracks, [], -1)).toEqual([]);
});
