import type { MediaSource } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  deriveNativeSubtitleState,
  deriveSubtitleMenuTracks,
  isSubtitlePending,
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
