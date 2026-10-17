import { expect, it } from 'vitest';

import { serverIndexForNativeTrack } from './playerQualitySelection';

it('preserves source-scoped server indices when a quality change renegotiates native playback', () => {
  const nativeTracks = [
    { id: 1, type: 'audio' },
    { id: 2, type: 'audio' },
    { id: 1, type: 'sub' },
    { id: 7, type: 'sub', isExternal: true },
  ];
  const serverStreams = [
    { Type: 'Audio', Index: 4 },
    { Type: 'Audio', Index: 9 },
    { Type: 'Subtitle', Index: 12 },
    { Type: 'Subtitle', Index: 14, IsExternal: true },
  ];
  expect(
    serverIndexForNativeTrack({ type: 'Audio', nativeId: 2, nativeTracks, serverStreams }),
  ).toBe(9);
  expect(
    serverIndexForNativeTrack({
      type: 'Subtitle',
      nativeId: 7,
      nativeTracks,
      serverStreams,
      externalIds: new Map([[14, 7]]),
    }),
  ).toBe(14);
  expect(
    serverIndexForNativeTrack({ type: 'Subtitle', nativeId: 1, nativeTracks, serverStreams }),
  ).toBe(12);
  expect(
    serverIndexForNativeTrack({ type: 'Subtitle', nativeId: 0, nativeTracks, serverStreams }),
  ).toBe(-1);
  expect(
    serverIndexForNativeTrack({ type: 'Audio', nativeId: 99, nativeTracks, serverStreams }),
  ).toBeUndefined();
});
