import type { MediaSource } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  deriveNativeSubtitleState,
  deriveSubtitleMenuTracks,
  isSubtitlePending,
  requiresServerSubtitleSwitch,
  subtitleChoiceForSource,
} from './playerSubtitleMenu';

const source = {
  id: 'version-a',
  mediaStreams: [
    { type: 'Audio', index: 4, displayTitle: '日语' },
    { type: 'Subtitle', index: 8, displayTitle: '简体中文 ASS', isExternal: true },
    { type: 'Subtitle', index: 12, displayTitle: '繁體中文 ASS', isExternal: true },
    { type: 'Subtitle', index: 19, displayTitle: 'English PGS' },
  ],
} as MediaSource;

const streams = source.mediaStreams.map((stream) => ({
  Type: stream.type,
  Index: stream.index,
  DisplayTitle: stream.displayTitle,
  IsExternal: stream.isExternal,
}));

describe('subtitle delivery during video transcoding', () => {
  const transcoded = {
    TranscodingUrl: '/videos/movie/master.m3u8?VideoCodec=h264',
    MediaStreams: [
      { Type: 'Subtitle', Index: 0, Codec: 'ass', IsExternal: true, DeliveryMethod: 'External' },
      { Type: 'Subtitle', Index: 3, Codec: 'srt', DeliveryMethod: 'External' },
      { Type: 'Subtitle', Index: 5, Codec: 'pgs', DeliveryMethod: 'Encode' },
      { Type: 'Subtitle', Index: 7, Codec: 'webvtt', DeliveryMethod: 'Hls' },
    ],
  };

  it('switches external subtitles and off locally without restarting HLS', () => {
    for (const index of [0, 3, -1, undefined]) {
      expect(requiresServerSubtitleSwitch(transcoded, index)).toBe(false);
    }
    expect(requiresServerSubtitleSwitch(transcoded, 5)).toBe(true);
    expect(requiresServerSubtitleSwitch(transcoded, 7)).toBe(true);
  });

  it('renegotiates when removing burned-in subtitles or selecting another subtitle', () => {
    const burned = {
      ...transcoded,
      TranscodingUrl: '/videos/movie/master.m3u8?subtitleMethod=encode&SubtitleStreamIndex=5',
    };
    expect(requiresServerSubtitleSwitch(burned, -1)).toBe(true);
    expect(requiresServerSubtitleSwitch(burned, 0)).toBe(true);
    expect(
      requiresServerSubtitleSwitch(burned, -1, 'https://media.test/master.m3u8?SubtitleMethod=Hls'),
    ).toBe(false);
  });

  it('negotiates a subtitle that needs encoding even before a transcode starts', () => {
    const direct = { MediaStreams: transcoded.MediaStreams };
    expect(requiresServerSubtitleSwitch(direct, 5)).toBe(true);
    expect(requiresServerSubtitleSwitch(direct, 0)).toBe(false);
    expect(requiresServerSubtitleSwitch(direct, 7)).toBe(false);
    expect(requiresServerSubtitleSwitch(undefined, 0)).toBe(false);
  });

  it('maps external ASS stream zero without matching original indices to embedded HLS tracks', () => {
    const native = [
      { type: 'sub', id: 1, isExternal: false },
      { type: 'sub', id: 2, isExternal: true },
    ];
    const ids = new Map([[0, 2]]);
    const state = deriveNativeSubtitleState(native, transcoded.MediaStreams, 2, ids, true);
    expect([...state.ids]).toEqual([[0, 2]]);
    expect(state.selectedIndex).toBe(0);
    expect(
      deriveNativeSubtitleState(native, transcoded.MediaStreams, 1, ids, true).selectedIndex,
    ).toBeUndefined();
    expect(
      deriveNativeSubtitleState(native, transcoded.MediaStreams, 0, ids, true).selectedIndex,
    ).toBe(-1);
  });
});

describe('subtitle menu before sidecars load', () => {
  it('lists all server subtitles when the native player has no tracks or cache files', () => {
    expect(deriveSubtitleMenuTracks(source, new Map(), 8, new Set())).toEqual([
      { index: 8, name: '简体中文 ASS', language: undefined, loading: true, failed: false },
      { index: 12, name: '繁體中文 ASS', language: undefined, loading: false, failed: false },
      { index: 19, name: 'English PGS', language: undefined, loading: false, failed: false },
    ]);
  });

  it('keeps menu IDs stable when embedded and external tracks arrive out of order', () => {
    const native = [
      { type: 'sub', id: 1, isExternal: false },
      { type: 'sub', id: 3, isExternal: true },
      { type: 'sub', id: 7, isExternal: true },
    ];
    const state = deriveNativeSubtitleState(
      native,
      streams,
      3,
      new Map([
        [12, 3],
        [8, 7],
      ]),
    );
    expect([...state.ids]).toEqual([
      [19, 1],
      [12, 3],
      [8, 7],
    ]);
    expect(state.selectedIndex).toBe(12);
    const menu = deriveSubtitleMenuTracks(source, state.ids, 12, new Set());
    expect(menu.map((track) => track.index)).toEqual([8, 12, 19]);
    expect(menu.every((track) => !track.loading)).toBe(true);
  });

  it('keeps a pre-load choice scoped to its item and media source, including off', () => {
    const choice = { itemId: 'movie', sourceId: source.id, index: 12 };
    expect(subtitleChoiceForSource(choice, 'movie', source.id)).toBe(12);
    expect(subtitleChoiceForSource(choice, 'movie', 'version-b')).toBeUndefined();
    expect(subtitleChoiceForSource(choice, 'next-episode', source.id)).toBeUndefined();
    expect(subtitleChoiceForSource({ ...choice, index: -1 }, 'movie', source.id)).toBe(-1);
    expect(deriveNativeSubtitleState([], streams, -1).selectedIndex).toBe(-1);
  });

  it('keeps failed sidecars selectable for retry rather than hiding them', () => {
    const menu = deriveSubtitleMenuTracks(source, new Map(), 8, new Set([8]));
    expect(menu).toHaveLength(3);
    expect(menu[0]).toMatchObject({ index: 8, failed: true, loading: false });
  });

  it('waits only for the latest selected subtitle, not other uncached sidecars', () => {
    const nativeIds = new Map([[8, 7]]);
    const pending = () =>
      deriveSubtitleMenuTracks(source, nativeIds, 12, new Set()).filter((track) => track.loading);
    expect(pending().map((track) => track.index)).toEqual([12]);
    expect(isSubtitlePending(12, nativeIds, new Set())).toBe(true);
    // Switching back to a loaded track or off immediately releases the wait.
    for (const index of [8, -1, undefined]) {
      expect(isSubtitlePending(index, nativeIds, new Set())).toBe(false);
      expect(
        deriveSubtitleMenuTracks(source, nativeIds, index, new Set()).some(
          (track) => track.loading,
        ),
      ).toBe(false);
    }
    // Native discovery completes the selected track while other rows stay unloaded.
    nativeIds.set(12, 3);
    expect(isSubtitlePending(12, nativeIds, new Set())).toBe(false);
    expect(pending()).toEqual([]);
    expect(isSubtitlePending(19, nativeIds, new Set([19]))).toBe(false);
  });
});
