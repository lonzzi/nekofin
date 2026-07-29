export const PLAYER_SEEK_INTERVAL_MS = 10_000;

export type PlayerTransportActionKey =
  | 'previousEpisode'
  | 'rewind10'
  | 'playPause'
  | 'forward10'
  | 'nextEpisode';

export type PlayerTransportAction = {
  accessibilityLabel: string;
  disabled: boolean;
  key: PlayerTransportActionKey;
  seekOffsetMs?: number;
};

export type PlayerActionButtonKey = 'episodes' | 'danmaku' | 'tracks' | 'playback';

export type PlayerActionButton = {
  accessibilityLabel: string;
  key: PlayerActionButtonKey;
};

type TransportActionOptions = {
  durationMs: number;
  hasNextEpisode: boolean;
  hasPreviousEpisode: boolean;
  isMovie: boolean;
  isPlaying: boolean;
};

type PlayerActionButtonOptions = {
  danmakuCount: number;
  episodeCount: number;
  isMovie: boolean;
};

type NormalizedSeekOptions = {
  currentTimeMs: number;
  durationMs: number;
  offsetMs: number;
};

const safeCount = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export function deriveTransportActions({
  durationMs,
  hasNextEpisode,
  hasPreviousEpisode,
  isMovie,
  isPlaying,
}: TransportActionOptions): PlayerTransportAction[] {
  const canSeek = Number.isFinite(durationMs) && durationMs > 0;
  const timeActions: PlayerTransportAction[] = [
    {
      accessibilityLabel: '后退 10 秒',
      disabled: !canSeek,
      key: 'rewind10',
      seekOffsetMs: -PLAYER_SEEK_INTERVAL_MS,
    },
    {
      accessibilityLabel: isPlaying ? '暂停' : '播放',
      disabled: false,
      key: 'playPause',
    },
    {
      accessibilityLabel: '前进 10 秒',
      disabled: !canSeek,
      key: 'forward10',
      seekOffsetMs: PLAYER_SEEK_INTERVAL_MS,
    },
  ];

  if (isMovie) return timeActions;

  return [
    {
      accessibilityLabel: '上一集',
      disabled: !hasPreviousEpisode,
      key: 'previousEpisode',
    },
    ...timeActions,
    {
      accessibilityLabel: '下一集',
      disabled: !hasNextEpisode,
      key: 'nextEpisode',
    },
  ];
}

export function derivePlayerActionButtons({
  danmakuCount,
  episodeCount,
  isMovie,
}: PlayerActionButtonOptions): PlayerActionButton[] {
  const resolvedDanmakuCount = safeCount(danmakuCount);
  const resolvedEpisodeCount = safeCount(episodeCount);
  const actions: PlayerActionButton[] = [];

  if (!isMovie && resolvedEpisodeCount > 0) {
    actions.push({
      accessibilityLabel: `剧集列表，共 ${resolvedEpisodeCount} 集`,
      key: 'episodes',
    });
  }

  actions.push(
    {
      accessibilityLabel: `弹幕设置，当前 ${resolvedDanmakuCount} 条`,
      key: 'danmaku',
    },
    {
      accessibilityLabel: '字幕与音轨',
      key: 'tracks',
    },
    {
      accessibilityLabel: '播放设置',
      key: 'playback',
    },
  );

  return actions;
}

export function getNormalizedSeekPosition({
  currentTimeMs,
  durationMs,
  offsetMs,
}: NormalizedSeekOptions): number | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  const resolvedCurrentTime = Number.isFinite(currentTimeMs) ? currentTimeMs : 0;
  const resolvedOffset = Number.isFinite(offsetMs) ? offsetMs : 0;
  const targetTime = Math.min(Math.max(resolvedCurrentTime + resolvedOffset, 0), durationMs);

  return targetTime / durationMs;
}
