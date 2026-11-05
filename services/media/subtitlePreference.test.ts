import { describe, expect, it } from 'vitest';

import { mapMediaSource } from './mappers';
import { resolvePlaybackSelection, resolvePreferredPlaybackTracks } from './playbackSelection';
import {
  parseSubtitlePreference,
  preferredSubtitleIndex,
  subtitlePreferenceForIndex,
  subtitlePreferenceKey,
} from './subtitlePreference';

const source = mapMediaSource({
  Id: 'episode-7',
  DefaultSubtitleStreamIndex: -1,
  MediaStreams: [
    { Type: 'Subtitle', Index: 3, Language: 'chi', Title: '繁体中文', Codec: 'ass' },
    {
      Type: 'Subtitle',
      Index: 5,
      Language: 'chi',
      Title: '简体中文',
      Codec: 'ass',
      IsExternal: true,
    },
  ],
});
const next = mapMediaSource({
  Id: 'episode-8',
  DefaultSubtitleStreamIndex: -1,
  MediaStreams: [
    { Type: 'Subtitle', Index: 5, Language: 'zh', Title: '繁体中文', Codec: 'ass' },
    {
      Type: 'Subtitle',
      Index: 9,
      Language: 'zho',
      Title: '简体中文',
      Codec: 'ass',
      IsExternal: true,
    },
  ],
});
const defaults = { audioLanguage: 'auto', subtitleLanguage: 'auto', subtitlesEnabled: true };

describe('subtitle choices across episodes and versions', () => {
  it('uses the series, server and account as the preference scope', () => {
    const server = { id: 'server', userId: 'user' };
    const item = { id: 'e7', type: 'Episode' as const, seriesId: 'series' };
    const key = subtitlePreferenceKey({ server, item });
    expect(subtitlePreferenceKey({ server, item: { ...item, id: 'e8' } })).toBe(key);
    expect(subtitlePreferenceKey({ server: { ...server, userId: 'other' }, item })).not.toBe(key);
    expect(subtitlePreferenceKey({ server: { ...server, id: 'other' }, item })).not.toBe(key);
    expect(
      subtitlePreferenceKey({ server, item: { ...item, seriesId: undefined } }),
    ).toBeUndefined();
  });

  it('matches the same subtitle without carrying a previous file index', () => {
    const subtitleChoice = subtitlePreferenceForIndex(source, 5);
    expect(preferredSubtitleIndex(next.mediaStreams, subtitleChoice)).toBe(9);
    const preferences = { ...defaults, subtitleChoice };
    expect(resolvePreferredPlaybackTracks([next], {}, preferences).subtitleStreamIndex).toBe(9);
    expect(resolvePlaybackSelection([next], {}, preferences).subtitleStreamIndex).toBe(9);
  });

  it('matches Big5 sidecars without language metadata, as in the reported episode', () => {
    const sidecar = mapMediaSource({
      Id: 'e7',
      MediaStreams: [{ Type: 'Subtitle', Index: 0, Title: 'Big5', Codec: 'ass', IsExternal: true }],
    });
    const choice = subtitlePreferenceForIndex(sidecar, 0);
    expect(preferredSubtitleIndex([{ ...sidecar.mediaStreams[0], index: 4 }], choice)).toBe(4);
  });

  it('keeps manual subtitle disabling for the next episode', () => {
    const preferences = { ...defaults, subtitleChoice: subtitlePreferenceForIndex(source, -1) };
    expect(resolvePreferredPlaybackTracks([next], {}, preferences).subtitleStreamIndex).toBe(-1);
    expect(resolvePlaybackSelection([next], {}, preferences).subtitleStreamIndex).toBe(-1);
  });

  it('matches a stable title when the next file omits language metadata', () => {
    const choice = subtitlePreferenceForIndex(source, 5);
    expect(preferredSubtitleIndex([{ ...next.mediaStreams[1], language: 'und' }], choice)).toBe(9);
    expect(
      preferredSubtitleIndex([{ ...next.mediaStreams[1], language: 'eng' }], choice),
    ).toBeUndefined();
  });

  it('lets an explicit choice override the remembered track and the global default', () => {
    const preferences = {
      ...defaults,
      subtitlesEnabled: false,
      subtitleChoice: subtitlePreferenceForIndex(source, 5),
    };
    expect(resolvePreferredPlaybackTracks([next], {}, preferences).subtitleStreamIndex).toBe(9);
    expect(resolvePlaybackSelection([next], {}, preferences).subtitleStreamIndex).toBe(9);
    expect(
      resolvePlaybackSelection(
        [next],
        { mediaSourceId: next.id, subtitleStreamIndex: 5 },
        preferences,
      ).subtitleStreamIndex,
    ).toBe(5);
  });

  it('falls back to configured defaults when a matching subtitle is unavailable', () => {
    const preferences = { ...defaults, subtitleChoice: subtitlePreferenceForIndex(source, 5) };
    expect(
      resolvePlaybackSelection(
        [{ ...next, mediaStreams: next.mediaStreams.slice(0, 1) }],
        {},
        preferences,
      ).subtitleStreamIndex,
    ).toBe(-1);
  });

  it('prefers full dialogue tracks over forced tracks with the same language', () => {
    const choice = subtitlePreferenceForIndex(source, 5);
    const track = { ...next.mediaStreams[1], title: null };
    expect(
      preferredSubtitleIndex(
        [
          { ...track, index: 2, isForced: true },
          { ...track, index: 8 },
        ],
        choice,
      ),
    ).toBe(8);
  });

  it('round-trips preferences and ignores corrupt or unrelated storage values', () => {
    const choice = subtitlePreferenceForIndex(source, 5);
    expect(parseSubtitlePreference(JSON.stringify(choice))).toEqual(choice);
    for (const value of [
      'bad',
      '{}',
      'null',
      '{"mode":"track"}',
      '{"mode":"track","language":5,"forced":false,"external":false}',
    ]) {
      expect(parseSubtitlePreference(value)).toBeUndefined();
    }
    expect(subtitlePreferenceForIndex(source, 88)).toBeUndefined();
  });
});
