import type { MenuAction } from '@react-native-menu/menu';

import type { MediaTrack, MediaTracks, TrackInfo } from './PlayerContext';

export const PLAYER_MENU_ACTION_IDS = {
  danmakuToggle: 'danmaku:toggle',
  danmakuSettings: 'danmaku:settings',
  danmakuSearch: 'danmaku:search',
} as const;

const AUDIO_PREFIX = 'track:audio:';
const SUBTITLE_PREFIX = 'track:subtitle:';
const RATE_PREFIX = 'playback:rate:';
const ASPECT_PREFIX = 'playback:aspect:';

export const PLAYER_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const PLAYER_ASPECT_OPTIONS = [
  { label: '自适应', value: 'fit' },
  { label: '铺满屏幕', value: 'fill' },
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
] as const;

export type PlayerMenuSelection =
  | { kind: 'danmakuToggle' }
  | { kind: 'danmakuSettings' }
  | { kind: 'danmakuSearch' }
  | { kind: 'audioTrack'; trackIndex: number }
  | { kind: 'subtitleTrack'; trackIndex: number }
  | { kind: 'rate'; rate: number }
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
  subtitle: track.language?.toUpperCase(),
  title: track.name,
});

export function deriveDanmakuMenuActions({
  commentCount,
  enabled,
}: {
  commentCount: number;
  enabled: boolean;
}): MenuAction[] {
  const safeCommentCount = Number.isFinite(commentCount)
    ? Math.max(0, Math.floor(commentCount))
    : 0;

  return [
    {
      id: PLAYER_MENU_ACTION_IDS.danmakuToggle,
      state: selectedState(enabled),
      title: '显示弹幕',
    },
    {
      id: PLAYER_MENU_ACTION_IDS.danmakuSettings,
      subtitle: `当前 ${safeCommentCount} 条`,
      title: '弹幕设置',
    },
    {
      id: PLAYER_MENU_ACTION_IDS.danmakuSearch,
      title: '搜索匹配弹幕',
    },
  ];
}

export function deriveTrackMenuActions(
  tracks?: MediaTracks,
  selectedTracks?: MediaTrack,
): MenuAction[] {
  const audioTracks = normalizeTracks(tracks?.audio, '音轨');
  const subtitleTracks = normalizeTracks(tracks?.subtitle, '字幕');
  const selectedSubtitle = selectedTracks?.subtitle;
  const selectedAudio = selectedTracks?.audio;
  const selectedSubtitleTitle = selectedSubtitle
    ? subtitleTracks.find((track) => track.index === selectedSubtitle.index)?.name ||
      selectedSubtitle.name.trim() ||
      `字幕 ${selectedSubtitle.index}`
    : '关闭字幕';
  const selectedAudioTitle = selectedAudio
    ? audioTracks.find((track) => track.index === selectedAudio.index)?.name ||
      selectedAudio.name.trim() ||
      `音轨 ${selectedAudio.index}`
    : audioTracks.length
      ? '默认音轨'
      : '暂无可用音轨';

  const audioActions: MenuAction[] = audioTracks.length
    ? audioTracks.map((track) => trackAction(AUDIO_PREFIX, track, selectedAudio))
    : [{ attributes: { disabled: true }, title: '暂无可用音轨' }];
  const subtitleActions: MenuAction[] = [
    {
      id: `${SUBTITLE_PREFIX}-1`,
      state: selectedState(!selectedSubtitle || selectedSubtitle.index === -1),
      title: '关闭字幕',
    },
    ...subtitleTracks.map((track) => trackAction(SUBTITLE_PREFIX, track, selectedSubtitle)),
  ];

  return [
    {
      subactions: subtitleActions,
      title: `字幕 · ${selectedSubtitleTitle}`,
    },
    {
      subactions: audioActions,
      title: `音轨 · ${selectedAudioTitle}`,
    },
  ];
}

export function derivePlaybackMenuActions(rate: number, aspectRatio = 'fit'): MenuAction[] {
  const aspectLabel =
    PLAYER_ASPECT_OPTIONS.find((option) => option.value === aspectRatio)?.label ?? aspectRatio;

  return [
    {
      subactions: PLAYER_RATES.map((value) => ({
        id: `${RATE_PREFIX}${value}`,
        state: selectedState(value === rate),
        title: value === 1 ? '正常' : `${value}×`,
      })),
      title: `播放速度 · ${rate === 1 ? '正常' : `${rate}×`}`,
    },
    {
      subactions: PLAYER_ASPECT_OPTIONS.map((option) => ({
        id: `${ASPECT_PREFIX}${option.value}`,
        state: selectedState(option.value === aspectRatio),
        title: option.label,
      })),
      title: `画面比例 · ${aspectLabel}`,
    },
  ];
}

export function parsePlayerMenuAction(actionId: string): PlayerMenuSelection | null {
  switch (actionId) {
    case PLAYER_MENU_ACTION_IDS.danmakuToggle:
      return { kind: 'danmakuToggle' };
    case PLAYER_MENU_ACTION_IDS.danmakuSettings:
      return { kind: 'danmakuSettings' };
    case PLAYER_MENU_ACTION_IDS.danmakuSearch:
      return { kind: 'danmakuSearch' };
  }

  if (actionId.startsWith(AUDIO_PREFIX)) {
    return parseTrackSelection('audioTrack', actionId.slice(AUDIO_PREFIX.length));
  }
  if (actionId.startsWith(SUBTITLE_PREFIX)) {
    return parseTrackSelection('subtitleTrack', actionId.slice(SUBTITLE_PREFIX.length));
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
