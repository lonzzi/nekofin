import { DandanComment } from '@/services/dandanplay';
import type { DanmakuCommentsData, DanmakuTrack } from '@/services/danmaku';
import type { PlaybackQuality } from '@/services/media/playbackQuality';
import { MediaItem, MediaSource } from '@/services/media/types';
import type { HdrStateChangeEvent, MediaInfo } from 'expo-mpv';
import { createContext, useContext, type RefObject } from 'react';
import { SharedValue } from 'react-native-reanimated';

import type { DanmakuSearchPanelRef } from './panels/DanmakuSearchPanel';
import type { PlayerPanelRoute } from './panels/playerPanelRoute';
import type { PlaybackDecodingMode } from './playbackDecoding';
import type { PlaybackSourceInfo } from './playbackInfo';
import type { createPlayerExitPreparation } from './playerExitPreparation';

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

export type PlayerLifecycleState = {
  entryVisible: boolean;
  isExiting: boolean;
  exitPreparation: ReturnType<typeof createPlayerExitPreparation> | null;
};

export type PlayerPlaybackState = {
  title: string;
  canSeek: boolean;
  isMovie: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isPlayerReady: boolean;
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
  decodingMode?: PlaybackDecodingMode;
  onDecodingModeChange?: (mode: PlaybackDecodingMode) => void;
  playbackSourceInfo?: PlaybackSourceInfo;
  readPlaybackMediaInfo?: () => Promise<MediaInfo | null>;
  aspectRatio?: string;
  onAspectRatioChange?: (mode: string) => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  mediaStats?: MediaStats | null;
  bufferedProgress?: SharedValue<number>;
  hdrState?: HdrStateChangeEvent | null;
  onCommentsLoaded?: (data: DanmakuCommentsData) => void;
  danmakuTracks?: DanmakuTrack[];
  danmakuSelection?: string;
  onDanmakuSelectionChange?: (value: string) => void;
  danmakuFailedSources?: string[];
  danmakuEpisodeInfo?: { animeTitle: string; episodeTitle: string } | undefined;
  danmakuComments: DandanComment[];
  episodes: MediaItem[];
  currentItem?: MediaItem | null;
  onEpisodeSelect: (episodeId: string) => void;
};

export type PlayerControlsState = {
  overlaysVisible: boolean;
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  showLockControl: boolean;
  toggleControlsVisibility: () => void;
  isLocked: boolean;
  onToggleLock: () => void;
  isInteractionLocked: () => boolean;
  fadeAnim: SharedValue<number>;
  lockFadeAnim: SharedValue<number>;
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
  onLayout: () => void;
};

export type PlayerPanelsState = {
  active: PlayerPanelRoute | undefined;
  title: string;
  canGoBack: boolean;
  searchRef: RefObject<DanmakuSearchPanelRef | null>;
  onBack: () => void;
  onDismiss: () => void;
  onEpisodeSelect: (episodeId: string) => void;
  onSearch: () => void;
  onCommentsLoaded: (data: DanmakuCommentsData) => void;
  onSearchNavigationChange: (navigation: { title: string; canGoBack: boolean }) => void;
};

export type PlayerContextValue = {
  lifecycle: PlayerLifecycleState;
  playback: PlayerPlaybackState;
  controls: PlayerControlsState;
  panels: PlayerPanelsState;
};

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return ctx;
}
