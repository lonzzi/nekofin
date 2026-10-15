import { describe, expect, it, vi } from 'vitest';

import { mapMediaSource } from './mappers';
import {
  needsPlaybackPreferenceTracks,
  parsePlaybackSelection,
  playbackSelectionParams,
  resolvePlaybackSelection,
  resolvePreferredPlaybackTracks,
} from './playbackSelection';
import { streamInfoQueryOptions } from './queryOptions';
import type { MediaAdapter, MediaServerInfo } from './types';

const source = mapMediaSource({
  Id: '480p',
  DefaultAudioStreamIndex: 0,
  DefaultSubtitleStreamIndex: 4,
  MediaStreams: [
    { Type: 'Audio', Index: 0, Language: 'eng' },
    { Type: 'Audio', Index: 2, Language: 'jpn' },
    { Type: 'Subtitle', Index: 3, Language: 'eng' },
    { Type: 'Subtitle', Index: 4, Language: 'chi', IsExternal: true },
  ],
});
const auto = { audioLanguage: 'auto', subtitleLanguage: 'auto', subtitlesEnabled: true };

describe('playback language preferences without detail-page parameters', () => {
  const preferences = { ...auto, audioLanguage: 'ja', subtitleLanguage: 'zh' };

  it('waits for track metadata only when an unselected language needs matching', () => {
    expect(needsPlaybackPreferenceTracks({}, preferences)).toBe(true);
    expect(
      needsPlaybackPreferenceTracks({ audioStreamIndex: 0, subtitleStreamIndex: -1 }, preferences),
    ).toBe(false);
    expect(needsPlaybackPreferenceTracks({}, auto)).toBe(false);
    expect(
      needsPlaybackPreferenceTracks(
        {},
        { ...auto, subtitleLanguage: 'zh', subtitlesEnabled: false },
      ),
    ).toBe(false);
  });

  it('resolves the server indices before requesting HLS, including external Chinese subtitles', async () => {
    const selection = resolvePreferredPlaybackTracks([source], {}, preferences);
    const getStreamInfo = vi.fn(async () => null);
    const options = streamInfoQueryOptions({
      adapter: { getStreamInfo } as unknown as MediaAdapter,
      currentServer: { id: 'emby', userId: 'test-user' } as MediaServerInfo,
      item: { id: 'movie', name: 'Test', type: 'Movie', raw: {} },
      keyOptions: {
        enableTranscoding: true,
        maxBitrate: 1000000,
        enableSubtitleBurnIn: false,
        selectedCodec: 'h264',
        ...selection,
      },
      deviceProfile: {},
      deviceId: 'test-device',
    });
    await options.queryFn!({} as never);
    expect(getStreamInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaSourceId: '480p',
        audioStreamIndex: 2,
        subtitleStreamIndex: 4,
      }),
    );
  });

  it('preserves explicit audio zero and subtitle off over global preferences', () => {
    expect(
      resolvePreferredPlaybackTracks(
        [source],
        { mediaSourceId: '480p', audioStreamIndex: 0, subtitleStreamIndex: -1 },
        preferences,
      ),
    ).toEqual({ mediaSourceId: '480p', audioStreamIndex: 0, subtitleStreamIndex: -1 });
  });

  it('does not override a manual audio choice while resolving the subtitle preference', () => {
    expect(resolvePreferredPlaybackTracks([source], { audioStreamIndex: 0 }, preferences)).toEqual({
      mediaSourceId: '480p',
      audioStreamIndex: 0,
      subtitleStreamIndex: 4,
    });
  });

  it('disables default subtitles but allows an explicit subtitle to override the setting', () => {
    const disabled = { ...auto, subtitlesEnabled: false };
    expect(resolvePreferredPlaybackTracks([source], {}, disabled).subtitleStreamIndex).toBe(-1);
    expect(
      resolvePreferredPlaybackTracks(
        [source],
        { mediaSourceId: '480p', subtitleStreamIndex: 4 },
        disabled,
      ).subtitleStreamIndex,
    ).toBe(4);
  });

  it('leaves auto and unavailable languages to the server and avoids a second negotiation', () => {
    expect(resolvePreferredPlaybackTracks([source], {}, auto)).toEqual({
      audioStreamIndex: undefined,
      subtitleStreamIndex: undefined,
    });
    expect(
      resolvePreferredPlaybackTracks(
        [source],
        {},
        { ...auto, audioLanguage: 'ko', subtitleLanguage: 'ko' },
      ),
    ).toEqual({ audioStreamIndex: undefined, subtitleStreamIndex: undefined });
    expect(resolvePreferredPlaybackTracks([source], { subtitleStreamIndex: -1 }, auto)).toEqual({
      audioStreamIndex: undefined,
      subtitleStreamIndex: -1,
    });
  });

  it('matches tracks in the selected version and never borrows another version indices', () => {
    const other = {
      ...source,
      id: '240p',
      mediaStreams: source.mediaStreams.map((track) => ({ ...track, index: track.index + 10 })),
    };
    expect(
      resolvePreferredPlaybackTracks([source, other], { mediaSourceId: '240p' }, preferences),
    ).toEqual({ mediaSourceId: '240p', audioStreamIndex: 12, subtitleStreamIndex: 14 });
    expect(
      resolvePreferredPlaybackTracks([source], { mediaSourceId: 'missing' }, preferences),
    ).toEqual({
      mediaSourceId: 'missing',
      audioStreamIndex: undefined,
      subtitleStreamIndex: undefined,
    });
  });
});

describe('detail playback selection', () => {
  it('retains zero audio index and external subtitle server index through navigation', () => {
    const selected = resolvePlaybackSelection([source], {}, auto);
    expect(selected).toEqual({
      mediaSourceId: '480p',
      audioStreamIndex: 0,
      subtitleStreamIndex: 4,
    });
    expect(parsePlaybackSelection(playbackSelectionParams(selected))).toEqual(selected);
  });

  it('lets explicit choices override language preferences and globally disabled subtitles', () => {
    expect(
      resolvePlaybackSelection(
        [source],
        { mediaSourceId: '480p', audioStreamIndex: 0, subtitleStreamIndex: 4 },
        { audioLanguage: 'ja', subtitleLanguage: 'en', subtitlesEnabled: false },
      ),
    ).toEqual({ mediaSourceId: '480p', audioStreamIndex: 0, subtitleStreamIndex: 4 });
  });

  it('keeps subtitle off explicit and uses language aliases when selecting defaults', () => {
    expect(
      resolvePlaybackSelection(
        [source],
        { mediaSourceId: '480p', subtitleStreamIndex: -1 },
        { ...auto, audioLanguage: 'ja', subtitleLanguage: 'zh' },
      ),
    ).toEqual({ mediaSourceId: '480p', audioStreamIndex: 2, subtitleStreamIndex: -1 });
  });

  it('does not apply stale stream indices to a different version or episode', () => {
    const another = { ...source, id: '240p', defaultAudioStreamIndex: 0 };
    expect(
      resolvePlaybackSelection(
        [another],
        { mediaSourceId: '480p', audioStreamIndex: 2, subtitleStreamIndex: 3 },
        auto,
      ),
    ).toEqual({ mediaSourceId: '240p', audioStreamIndex: 0, subtitleStreamIndex: 4 });
  });

  it('validates track membership within the chosen version', () => {
    expect(
      resolvePlaybackSelection(
        [source],
        { mediaSourceId: '480p', audioStreamIndex: 4, subtitleStreamIndex: 2 },
        auto,
      ),
    ).toEqual({ mediaSourceId: '480p', audioStreamIndex: 0, subtitleStreamIndex: 4 });
  });

  it('respects server subtitle off and does not enable an arbitrary subtitle', () => {
    expect(
      resolvePlaybackSelection([{ ...source, defaultSubtitleStreamIndex: -1 }], {}, auto)
        .subtitleStreamIndex,
    ).toBe(-1);
    expect(
      resolvePlaybackSelection([{ ...source, defaultSubtitleStreamIndex: undefined }], {}, auto)
        .subtitleStreamIndex,
    ).toBe(-1);
    expect(resolvePlaybackSelection([], {}, auto)).toEqual({});
  });

  it('rejects malformed navigation indices and accepts subtitle off', () => {
    expect(
      parsePlaybackSelection({
        mediaSourceId: ['480p', '240p'],
        audioStreamIndex: '-1',
        subtitleStreamIndex: '-2',
      }),
    ).toEqual({
      mediaSourceId: undefined,
      audioStreamIndex: undefined,
      subtitleStreamIndex: undefined,
    });
    for (const invalid of ['', 'NaN', '1.5', '1e2', '9007199254740992']) {
      expect(
        parsePlaybackSelection({ audioStreamIndex: invalid }).audioStreamIndex,
      ).toBeUndefined();
    }
    expect(parsePlaybackSelection({ subtitleStreamIndex: '-1' }).subtitleStreamIndex).toBe(-1);
  });
});
