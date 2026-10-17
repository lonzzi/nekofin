import { expect, it } from 'vitest';

import { prioritizeSubtitleTracks } from './externalTracks';

it('loads the selected subtitle before other tracks without mutating server order', () => {
  const tracks = [{ index: 1 }, { index: 2 }, { index: 3 }];
  expect(prioritizeSubtitleTracks(tracks, 3).map((track) => track.index)).toEqual([3, 1, 2]);
  expect(tracks.map((track) => track.index)).toEqual([1, 2, 3]);
  expect(prioritizeSubtitleTracks(tracks, -1)).toEqual(tracks);
  expect(prioritizeSubtitleTracks(tracks, 99)).toEqual(tracks);
});
