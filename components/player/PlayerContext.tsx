import { DandanComment } from '@/services/dandanplay';
import type { DanmakuCommentsData, DanmakuTrack } from '@/services/danmaku';
import type { PlaybackQuality } from '@/services/media/playbackQuality';
import { MediaItem, MediaSource } from '@/services/media/types';
import type { HdrStateChangeEvent, MediaInfo } from 'expo-mpv';
import { createContext, useContext } from 'react';
import { SharedValue } from 'react-native-reanimated';

import type { PlayerPanelRoute } from './panels/playerPanelRoute';
import type { PlaybackSourceInfo } from './playbackInfo';

export type TrackInfo = {
  name: string;
  index: number;
  language?: string;
  loading?: boolean;
  failed?: boolean;
};

export type VlcTrack = {
  id: number;
  name: string;
};

export type MediaTrack = {
  audio?: TrackInfo;
  subtitle?: TrackInfo;
};

export type MediaTracks = {
  audio?: TrackInfo[];
  subtitle?: TrackInfo[];
};

export type MediaStats = {
  readBytes: number;
  inputBitrate: number;
  demuxReadBytes: number;
  demuxBitrate: number;
  demuxCorrupted: number;
  demuxDiscontinuity: number;
  decodedVideo: number;
  decodedAudio: number;
  displayedPictures: number;
  lostPictures: number;
  playedAudioBuffers: number;
  lostAudioBuffers: number;
  sentPackets: number;
  sentBytes: number;
  sendBitrate: number;
};

export type PlayerContextValue = {
  title: string;
  isPlaying: boolean;
  isLoading: boolean;
  canSeek: boolean;
  duration: number;
  currentTime: SharedValue<number>;
  onSeek: (position: number) => void;
  onPlayPause: () => void;
  onRateChange?: (newRate: number | null, options?: { remember?: boolean }) => void;
  rate: number;
  tracks?: MediaTracks;
  selectedTracks?: MediaTrack;
  onAudioTrackChange?: (trackIndex: number) => void;
  onSubtitleTrackChange?: (trackIndex: number) => void;
  mediaSources?: MediaSource[];
  selectedMediaSourceId?: string | null;
  onMediaSourceChange?: (id: string) => void;
  quality?: PlaybackQuality;
  onQualityChange?: (quality: PlaybackQuality) => void;
  playbackSourceInfo?: PlaybackSourceInfo;
  readPlaybackMediaInfo?: () => Promise<MediaInfo | null>;
  aspectRatio?: string;
  onAspectRatioChange?: (mode: string) => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  mediaStats?: MediaStats | null;
  /** 已缓冲进度(0-1),用于在进度条上绘制缓冲区间。 */
  bufferedProgress?: SharedValue<number>;
  /** HDR/Dolby Vision 状态,用于标题栏徽标。 */
  hdrState?: HdrStateChangeEvent | null;

  showControls: boolean;
  setShowControls: (show: boolean) => void;
  fadeAnim: SharedValue<number>;
  isPanelOpen: boolean;
  openPanel: (route: PlayerPanelRoute) => void;
  isDragging: boolean;
  seekPreviewTime: SharedValue<number>;
  seekPreviewStartTime: SharedValue<number>;
  setIsDragging: (dragging: boolean) => void;
  isGestureSeekingActive: SharedValue<boolean>;
  isVolumeGestureActive: SharedValue<boolean>;
  isBrightnessGestureActive: SharedValue<boolean>;
  hideControlsWithDelay: () => void;
  clearControlsTimeout: () => void;
  onCommentsLoaded?: (data: DanmakuCommentsData) => void;
  danmakuTracks?: DanmakuTrack[];
  danmakuSelection?: string;
  onDanmakuSelectionChange?: (value: string) => void;
  danmakuFailedSources?: string[];
  danmakuEpisodeInfo?: { animeTitle: string; episodeTitle: string } | undefined;
  danmakuComments: DandanComment[];

  // Episode list related
  episodes: MediaItem[];
  currentItem?: MediaItem | null;
  isMovie: boolean;
  onEpisodeSelect: (episodeId: string) => void;
};

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within PlayerContext.Provider');
  }
  return ctx;
}
