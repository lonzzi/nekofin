import { t as tr } from '@/lib/i18n';
import {
  parsePlaybackQuality,
  playbackQualityOptions,
  type PlaybackQuality,
} from '@/services/media/playbackQuality';
import { playbackSourceLabel } from '@/services/media/playbackSelection';
import type { MediaChapter, MediaSource } from '@/services/media/types';
import type { MenuAction } from '@react-native-menu/menu';

import {
  parsePlaybackDecodingMode,
  PLAYBACK_DECODING_MODES,
  type PlaybackDecodingMode,
} from './playbackDecoding';
import type { MediaTrack, MediaTracks, TrackInfo } from './PlayerContext';

export const PLAYER_MENU_ACTION_IDS = {
  danmakuToggle: 'danmaku:toggle',
  danmakuSettings: 'danmaku:settings',
  danmakuSearch: 'danmaku:search',
  autoSkipIntro: 'playback:autoSkipIntro',
  autoSkipOutro: 'playback:autoSkipOutro',
  brightnessGestureToggle: 'playback:gesture:brightness',
  volumeGestureToggle: 'playback:gesture:volume',
  seekGestureToggle: 'playback:gesture:seek',
} as const;

const AUDIO_PREFIX = 'track:audio:';
const SUBTITLE_PREFIX = 'track:subtitle:';
const VERSION_PREFIX = 'source:';
const RATE_PREFIX = 'playback:rate:';
const ASPECT_PREFIX = 'playback:aspect:';
const QUALITY_PREFIX = 'playback:quality:';
const CHAPTER_PREFIX = 'playback:chapter:';
const DECODING_PREFIX = 'playback:decoding:';

export const PLAYER_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const PLAYER_ASPECT_OPTIONS = [
  {
    get label() {
      return tr('player.aspectFit');
    },
    value: 'fit',
  },
  {
    get label() {
      return tr('player.aspectFill');
    },
    value: 'fill',
  },
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
] as const;

export type PlayerMenuSelection =
  | { kind: 'danmakuToggle' }
  | { kind: 'danmakuSettings' }
  | { kind: 'danmakuSearch' }
  | { kind: 'autoSkipIntro' }
  | { kind: 'autoSkipOutro' }
  | { kind: 'brightnessGestureToggle' }
  | { kind: 'volumeGestureToggle' }
  | { kind: 'seekGestureToggle' }
  | { kind: 'audioTrack'; trackIndex: number }
  | { kind: 'subtitleTrack'; trackIndex: number }
  | { kind: 'mediaSource'; id: string }
  | { kind: 'rate'; rate: number }
  | { kind: 'quality'; quality: PlaybackQuality }
  | { kind: 'decoding'; mode: PlaybackDecodingMode }
  | { kind: 'chapter'; timeMs: number }
  | { aspectRatio: string; kind: 'aspectRatio' };

const selectedState = (selected: boolean): MenuAction['state'] => (selected ? 'on' : 'off');

const normalizeTracks = (tracks: TrackInfo[] | undefined, fallbackLabel: string): TrackInfo[] => {
  const tracksByIndex = new Map<number, TrackInfo>();
  for (const track of tracks ?? []) {
    if (
      !Number.isSafeInteger(track.index) ||
      track.index === -1 ||
      tracksByIndex.has(track.index)
    ) {
      continue;
    }
    tracksByIndex.set(track.index, {
      ...track,
      name: track.name.trim() || `${fallbackLabel} ${track.index}`,
    });
  }
  return [...tracksByIndex.values()].sort((a, b) => a.index - b.index);
};

const trackAction = (prefix: string, track: TrackInfo, selectedTrack?: TrackInfo): MenuAction => ({
  id: `${prefix}${track.index}`,
  state: selectedState(track.index === selectedTrack?.index),
  subtitle: track.failed ? tr('common.loadFailedTapToRetry') : track.language?.toUpperCase(),
  title: track.name,
});

export function deriveDanmakuMenuActions(
  {
    commentCount,
    enabled,
  }: {
    commentCount: number;
    enabled: boolean;
  },
  translate = tr,
): MenuAction[] {
  const safeCommentCount = Number.isFinite(commentCount)
    ? Math.max(0, Math.floor(commentCount))
    : 0;

  return [
    {
      id: PLAYER_MENU_ACTION_IDS.danmakuToggle,
      state: selectedState(enabled),
      title: translate('danmaku.showComments'),
    },
    {
      id: PLAYER_MENU_ACTION_IDS.danmakuSettings,
      subtitle: translate('danmaku.currentCount', { count: safeCommentCount }),
      title: translate('danmaku.settings'),
    },
    {
      id: PLAYER_MENU_ACTION_IDS.danmakuSearch,
      title: translate('danmaku.findMatchingComments'),
    },
  ];
}

export function deriveTrackMenuActions(
  tracks?: MediaTracks,
  selectedTracks?: MediaTrack,
  mediaSources: MediaSource[] = [],
  selectedMediaSourceId?: string | null,
  translate = tr,
): MenuAction[] {
  const audioTracks = normalizeTracks(tracks?.audio, translate('player.audioTrack'));
  const subtitleTracks = normalizeTracks(tracks?.subtitle, translate('player.subtitles'));
  const selectedSubtitle = selectedTracks?.subtitle;
  const selectedAudio = selectedTracks?.audio;
  const selectedSubtitleTitle = selectedSubtitle
    ? subtitleTracks.find((track) => track.index === selectedSubtitle.index)?.name ||
      selectedSubtitle.name.trim() ||
      translate('player.subtitleByIndex', { index: selectedSubtitle.index })
    : translate('player.disableSubtitles');
  const selectedAudioTitle = selectedAudio
    ? audioTracks.find((track) => track.index === selectedAudio.index)?.name ||
      selectedAudio.name.trim() ||
      translate('player.audioTrackByIndex', { index: selectedAudio.index })
    : audioTracks.length
      ? translate('player.defaultAudioTrack')
      : translate('player.noAudioTracks');

  const audioActions: MenuAction[] = audioTracks.length
    ? audioTracks.map((track) => trackAction(AUDIO_PREFIX, track, selectedAudio))
    : [{ attributes: { disabled: true }, title: translate('player.noAudioTracks') }];
  const subtitleActions: MenuAction[] = [
    {
      id: `${SUBTITLE_PREFIX}-1`,
      state: selectedState(!selectedSubtitle || selectedSubtitle.index === -1),
      title: translate('player.disableSubtitles'),
    },
    ...subtitleTracks.map((track) => trackAction(SUBTITLE_PREFIX, track, selectedSubtitle)),
  ];

  const versionActions: MenuAction[] =
    mediaSources.length > 1
      ? [
          {
            title: translate('player.videoVersion'),
            subactions: mediaSources
              .filter((source) => source.id)
              .map((source, index) => ({
                id: `${VERSION_PREFIX}${source.id}`,
                title: playbackSourceLabel(source, index),
                state: selectedState(source.id === selectedMediaSourceId),
              })),
          },
        ]
      : [];

  return [
    ...versionActions,
    {
      subactions: subtitleActions,
      title: translate('player.selectedSubtitle', {
        selectedSubtitleTitle: selectedSubtitleTitle,
      }),
    },
    {
      subactions: audioActions,
      title: translate('player.selectedAudioTrack', { selectedAudioTitle: selectedAudioTitle }),
    },
  ];
}

export function derivePlaybackMenuActions(
  rate: number,
  aspectRatio = 'fit',
  translate = tr,
  {
    brightnessGestureEnabled = true,
    volumeGestureEnabled = true,
    seekGestureEnabled = true,
    decodingMode,
  }: {
    brightnessGestureEnabled?: boolean;
    volumeGestureEnabled?: boolean;
    seekGestureEnabled?: boolean;
    decodingMode?: PlaybackDecodingMode;
  } = {},
): MenuAction[] {
  const aspectLabel =
    PLAYER_ASPECT_OPTIONS.find((option) => option.value === aspectRatio)?.label ?? aspectRatio;

  return [
    {
      subactions: PLAYER_RATES.map((value) => ({
        id: `${RATE_PREFIX}${value}`,
        state: selectedState(value === rate),
        title: value === 1 ? translate('player.normalSpeed') : `${value}×`,
      })),
      title: translate('player.selectedPlaybackSpeed', {
        value: rate === 1 ? translate('player.normalSpeed') : `${rate}×`,
      }),
    },
    {
      subactions: PLAYER_ASPECT_OPTIONS.map((option) => ({
        id: `${ASPECT_PREFIX}${option.value}`,
        state: selectedState(option.value === aspectRatio),
        title: option.label,
      })),
      title: translate('player.selectedAspectRatio', { aspectLabel: aspectLabel }),
    },
    {
      title: translate('player.gestureControls'),
      subactions: [
        {
          id: PLAYER_MENU_ACTION_IDS.brightnessGestureToggle,
          state: selectedState(brightnessGestureEnabled),
          title: translate('player.brightnessGesture'),
        },
        {
          id: PLAYER_MENU_ACTION_IDS.volumeGestureToggle,
          state: selectedState(volumeGestureEnabled),
          title: translate('player.volumeGesture'),
        },
        {
          id: PLAYER_MENU_ACTION_IDS.seekGestureToggle,
          state: selectedState(seekGestureEnabled),
          title: translate('player.seekGesture'),
        },
      ],
    },
    ...(decodingMode
      ? [
          {
            title: translate('player.selectedDecodingMode', {
              value: translate(`player.decoding.${decodingMode}`),
            }),
            subactions: PLAYBACK_DECODING_MODES.map((mode) => ({
              id: `${DECODING_PREFIX}${mode}`,
              title: translate(`player.decoding.${mode}`),
              state: selectedState(mode === decodingMode),
            })),
          },
        ]
      : []),
  ];
}

export function deriveAutoSkipMenuActions(
  { intro, outro }: { intro: boolean; outro: boolean },
  translate = tr,
): MenuAction[] {
  return [
    {
      id: PLAYER_MENU_ACTION_IDS.autoSkipIntro,
      title: translate('player.autoSkipIntro'),
      state: selectedState(intro),
    },
    {
      id: PLAYER_MENU_ACTION_IDS.autoSkipOutro,
      title: translate('player.autoSkipOutro'),
      state: selectedState(outro),
    },
  ];
}

export function deriveQualityMenuActions(
  quality: PlaybackQuality = 'auto',
  translate = tr,
): MenuAction[] {
  return playbackQualityOptions.map((option) => ({
    id: `${QUALITY_PREFIX}${option.id}`,
    title: option.id === 'auto' ? translate('player.usePlaybackSettings') : option.title,
    state: selectedState(option.id === quality),
  }));
}

export function deriveChapterMenuAction(
  chapters: MediaChapter[],
  canSeek: boolean,
  translate = tr,
): MenuAction[] {
  if (!chapters.length) return [];
  return [
    {
      title: translate('player.chapters'),
      subactions: chapters.map((chapter, index) => {
        const seconds = Math.floor(chapter.startTimeMs / 1000);
        const timestamp =
          seconds >= 3600
            ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
            : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        return {
          id: `${CHAPTER_PREFIX}${chapter.startTimeMs}`,
          title: `${timestamp}  ${chapter.name || translate('player.chapterNumber', { number: index + 1 })}`,
          attributes: { disabled: !canSeek },
        };
      }),
    },
  ];
}

export function parsePlayerMenuAction(actionId: string): PlayerMenuSelection | null {
  if (actionId.startsWith(DECODING_PREFIX)) {
    const mode = parsePlaybackDecodingMode(actionId.slice(DECODING_PREFIX.length));
    return mode ? { kind: 'decoding', mode } : null;
  }
  if (actionId.startsWith(CHAPTER_PREFIX)) {
    const value = actionId.slice(CHAPTER_PREFIX.length);
    const timeMs = Number(value);
    return value.trim() && Number.isFinite(timeMs) && timeMs >= 0
      ? { kind: 'chapter', timeMs }
      : null;
  }
  if (actionId.startsWith(QUALITY_PREFIX)) {
    const quality = parsePlaybackQuality(actionId.slice(QUALITY_PREFIX.length));
    return quality ? { kind: 'quality', quality } : null;
  }
  switch (actionId) {
    case PLAYER_MENU_ACTION_IDS.autoSkipIntro:
      return { kind: 'autoSkipIntro' };
    case PLAYER_MENU_ACTION_IDS.autoSkipOutro:
      return { kind: 'autoSkipOutro' };
    case PLAYER_MENU_ACTION_IDS.danmakuToggle:
      return { kind: 'danmakuToggle' };
    case PLAYER_MENU_ACTION_IDS.danmakuSettings:
      return { kind: 'danmakuSettings' };
    case PLAYER_MENU_ACTION_IDS.danmakuSearch:
      return { kind: 'danmakuSearch' };
    case PLAYER_MENU_ACTION_IDS.brightnessGestureToggle:
      return { kind: 'brightnessGestureToggle' };
    case PLAYER_MENU_ACTION_IDS.volumeGestureToggle:
      return { kind: 'volumeGestureToggle' };
    case PLAYER_MENU_ACTION_IDS.seekGestureToggle:
      return { kind: 'seekGestureToggle' };
  }

  if (actionId.startsWith(AUDIO_PREFIX)) {
    return parseTrackSelection('audioTrack', actionId.slice(AUDIO_PREFIX.length));
  }
  if (actionId.startsWith(SUBTITLE_PREFIX)) {
    return parseTrackSelection('subtitleTrack', actionId.slice(SUBTITLE_PREFIX.length));
  }
  if (actionId.startsWith(VERSION_PREFIX)) {
    const id = actionId.slice(VERSION_PREFIX.length);
    return id ? { kind: 'mediaSource', id } : null;
  }
  if (actionId.startsWith(RATE_PREFIX)) {
    const rate = Number(actionId.slice(RATE_PREFIX.length));
    return PLAYER_RATES.some((option) => option === rate) ? { kind: 'rate', rate } : null;
  }
  if (actionId.startsWith(ASPECT_PREFIX)) {
    const aspectRatio = actionId.slice(ASPECT_PREFIX.length);
    return PLAYER_ASPECT_OPTIONS.some((option) => option.value === aspectRatio)
      ? { aspectRatio, kind: 'aspectRatio' }
      : null;
  }

  return null;
}

function parseTrackSelection(
  kind: 'audioTrack' | 'subtitleTrack',
  encodedIndex: string,
): PlayerMenuSelection | null {
  if (!/^-?\d+$/.test(encodedIndex)) return null;
  const trackIndex = Number(encodedIndex);
  return Number.isSafeInteger(trackIndex) ? { kind, trackIndex } : null;
}
