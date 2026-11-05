import { t as tr } from '@/lib/i18n';
import { DEFAULT_PLAYER_SEEK_SECONDS, parsePlayerSeekSeconds } from '@/lib/playerSeekSettings';

export const PLAYER_SEEK_INTERVAL_MS = DEFAULT_PLAYER_SEEK_SECONDS * 1000;

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

export type PlayerActionButtonKey = 'episodes' | 'danmaku' | 'tracks' | 'quality' | 'playback';

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
  backwardSeconds?: number;
  forwardSeconds?: number;
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

export function canSeekPlayback({
  durationMs,
  isPlayerReady,
}: {
  durationMs: number;
  isPlayerReady: boolean;
}): boolean {
  return isPlayerReady && Number.isFinite(durationMs) && durationMs > 0;
}

export function deriveTransportActions({
  durationMs,
  hasNextEpisode,
  hasPreviousEpisode,
  isMovie,
  isPlaying,
  backwardSeconds,
  forwardSeconds,
}: TransportActionOptions): PlayerTransportAction[] {
  const backward = parsePlayerSeekSeconds(backwardSeconds);
  const forward = parsePlayerSeekSeconds(forwardSeconds);
  const canSeek = Number.isFinite(durationMs) && durationMs > 0;
  const timeActions: PlayerTransportAction[] = [
    {
      accessibilityLabel: tr('player.skipBackward', { seconds: backward }),
      disabled: !canSeek,
      key: 'rewind10',
      seekOffsetMs: -backward * 1000,
    },
    {
      accessibilityLabel: isPlaying ? tr('player.pause') : tr('player.play'),
      disabled: false,
      key: 'playPause',
    },
    {
      accessibilityLabel: tr('player.skipForward', { seconds: forward }),
      disabled: !canSeek,
      key: 'forward10',
      seekOffsetMs: forward * 1000,
    },
  ];

  if (isMovie) return timeActions;

  return [
    {
      accessibilityLabel: tr('player.previousEpisode'),
      disabled: !hasPreviousEpisode,
      key: 'previousEpisode',
    },
    ...timeActions,
    {
      accessibilityLabel: tr('player.nextEpisode'),
      disabled: !hasNextEpisode,
      key: 'nextEpisode',
    },
  ];
}

export function derivePlayerActionButtons(
  { danmakuCount, episodeCount, isMovie }: PlayerActionButtonOptions,
  translate = tr,
): PlayerActionButton[] {
  const resolvedDanmakuCount = safeCount(danmakuCount);
  const resolvedEpisodeCount = safeCount(episodeCount);
  const actions: PlayerActionButton[] = [];

  if (!isMovie && resolvedEpisodeCount > 0) {
    actions.push({
      accessibilityLabel: translate('player.episodeListWithCount', { count: resolvedEpisodeCount }),
      key: 'episodes',
    });
  }

  actions.push(
    {
      accessibilityLabel: translate('danmaku.settingsWithCount', { count: resolvedDanmakuCount }),
      key: 'danmaku',
    },
    {
      accessibilityLabel: translate('player.subtitlesAndAudio'),
      key: 'tracks',
    },
    {
      accessibilityLabel: translate('player.quality'),
      key: 'quality',
    },
    {
      accessibilityLabel: translate('player.settings'),
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
