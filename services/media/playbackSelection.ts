import { t as tr } from '@/lib/i18n';
import { preferredTrackId } from '@/lib/playbackPreferences';

import { parsePlaybackQuality, type PlaybackQuality } from './playbackQuality';
import type { MediaSource, MediaStream } from './types';

export type PlaybackSelection = {
  mediaSourceId?: string;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  quality?: PlaybackQuality;
};

export type PlaybackPreferences = {
  audioLanguage: string;
  subtitleLanguage: string;
  subtitlesEnabled: boolean;
};

export function needsPlaybackPreferenceTracks(
  selection: PlaybackSelection,
  preferences: PlaybackPreferences,
) {
  return (
    (selection.audioStreamIndex == null && preferences.audioLanguage !== 'auto') ||
    (selection.subtitleStreamIndex == null &&
      preferences.subtitlesEnabled &&
      preferences.subtitleLanguage !== 'auto')
  );
}

/** Resolve preferences before negotiation: HLS contains only the selected audio. */
export function resolvePreferredPlaybackTracks(
  sources: MediaSource[],
  selection: PlaybackSelection,
  preferences: PlaybackPreferences,
): PlaybackSelection {
  const source = selection.mediaSourceId
    ? sources.find((entry) => entry.id === selection.mediaSourceId)
    : sources[0];
  const preferred = (type: MediaStream['type'], language: string) =>
    preferredTrackId(
      (source?.mediaStreams ?? [])
        .filter((track) => track.type === type)
        .map((track) => ({ id: track.index, lang: track.language ?? undefined })),
      language,
    );
  const preferredAudio =
    selection.audioStreamIndex == null ? preferred('Audio', preferences.audioLanguage) : undefined;
  const preferredSubtitle =
    selection.subtitleStreamIndex == null && preferences.subtitlesEnabled
      ? preferred('Subtitle', preferences.subtitleLanguage)
      : undefined;
  const audioStreamIndex = selection.audioStreamIndex ?? preferredAudio;
  const subtitleStreamIndex =
    selection.subtitleStreamIndex ?? (preferences.subtitlesEnabled ? preferredSubtitle : -1);
  return {
    ...selection,
    // Pin the version whose stream indices were used, without changing 'auto'.
    ...(source && (preferredAudio != null || preferredSubtitle != null)
      ? { mediaSourceId: source.id }
      : {}),
    audioStreamIndex,
    subtitleStreamIndex,
  };
}

type RouteValue = string | string[] | undefined;

export function parsePlaybackSelection(params: {
  mediaSourceId?: RouteValue;
  audioStreamIndex?: RouteValue;
  subtitleStreamIndex?: RouteValue;
  quality?: RouteValue;
}): PlaybackSelection {
  const parseIndex = (value: RouteValue, minimum: number) => {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return undefined;
    const index = Number(value);
    return Number.isSafeInteger(index) && index >= minimum ? index : undefined;
  };
  const quality = parsePlaybackQuality(params.quality);
  return {
    mediaSourceId:
      typeof params.mediaSourceId === 'string' && params.mediaSourceId
        ? params.mediaSourceId
        : undefined,
    audioStreamIndex: parseIndex(params.audioStreamIndex, 0),
    subtitleStreamIndex: parseIndex(params.subtitleStreamIndex, -1),
    ...(quality ? { quality } : {}),
  };
}

export function playbackSelectionParams(selection?: PlaybackSelection): Record<string, string> {
  const params: Record<string, string> = {};
  if (selection?.mediaSourceId) params.mediaSourceId = selection.mediaSourceId;
  if (selection?.audioStreamIndex != null)
    params.audioStreamIndex = String(selection.audioStreamIndex);
  if (selection?.subtitleStreamIndex != null)
    params.subtitleStreamIndex = String(selection.subtitleStreamIndex);
  if (selection?.quality) params.quality = selection.quality;
  return params;
}

export function resolvePlaybackSelection(
  sources: MediaSource[],
  choice: PlaybackSelection,
  preferences: PlaybackPreferences,
): PlaybackSelection {
  const source = sources.find((entry) => entry.id === choice.mediaSourceId) ?? sources[0];
  if (!source) return {};
  const audio = source.mediaStreams.filter((stream) => stream.type === 'Audio');
  const subtitles = source.mediaStreams.filter((stream) => stream.type === 'Subtitle');
  // Stream indices belong to a particular version, never to another version.
  const scoped = choice.mediaSourceId === source.id ? choice : {};
  const valid = (tracks: MediaStream[], index?: number) =>
    tracks.find((track) => track.index === index)?.index;
  const preferred = (tracks: MediaStream[], language: string) =>
    preferredTrackId(
      tracks.map((track) => ({ id: track.index, lang: track.language ?? undefined })),
      language,
    );
  return {
    mediaSourceId: source.id,
    ...(choice.quality ? { quality: choice.quality } : {}),
    audioStreamIndex:
      valid(audio, scoped.audioStreamIndex) ??
      preferred(audio, preferences.audioLanguage) ??
      valid(audio, source.defaultAudioStreamIndex) ??
      audio.find((track) => track.isDefault)?.index ??
      audio[0]?.index,
    subtitleStreamIndex:
      scoped.subtitleStreamIndex === -1
        ? -1
        : (valid(subtitles, scoped.subtitleStreamIndex) ??
          (preferences.subtitlesEnabled
            ? (preferred(subtitles, preferences.subtitleLanguage) ??
              (source.defaultSubtitleStreamIndex === -1
                ? -1
                : valid(subtitles, source.defaultSubtitleStreamIndex)) ??
              subtitles.find((track) => track.isDefault || track.isForced)?.index ??
              -1)
            : -1)),
  };
}

export function playbackTrackLabel(stream: MediaStream) {
  const serverTitle = stream.displayTitle?.trim();
  if (serverTitle) return serverTitle;

  const languages: Record<string, string> = {
    zh: tr('settings.languageChinese'),
    zho: tr('settings.languageChinese'),
    chi: tr('settings.languageChinese'),
    cmn: tr('settings.languageChinese'),
    en: tr('settings.languageEnglish'),
    eng: tr('settings.languageEnglish'),
    ja: tr('settings.languageJapanese'),
    jpn: tr('settings.languageJapanese'),
    ko: tr('settings.languageKorean'),
    kor: tr('settings.languageKorean'),
  };
  const languageCode = stream.language?.trim();
  const language = languageCode
    ? (languages[languageCode.toLowerCase()] ?? languageCode)
    : undefined;
  const title = stream.title?.trim();
  const label = title
    ? `${title}${language ? ` · ${language}` : ''}`
    : language
      ? `${language}${stream.codec ? ` · ${stream.codec.toUpperCase()}` : ''}`
      : `${stream.type === 'Audio' ? tr('player.audioTrack') : tr('player.subtitles')} ${stream.index}${stream.codec ? ` · ${stream.codec.toUpperCase()}` : ''}`;
  return `${label}${stream.isExternal ? tr('player.externalTrackSuffix') : ''}`;
}

export function playbackSourceLabel(source: MediaSource, index: number) {
  return (
    source.name?.trim() ||
    source.mediaStreams.find((stream) => stream.type === 'Video')?.displayTitle?.trim() ||
    tr('player.sourceVersion', {
      value: source.container ? `${source.container.toUpperCase()} · ` : '',
      value2: index + 1,
    })
  );
}
