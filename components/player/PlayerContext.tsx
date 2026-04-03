import { DandanComment } from '@/services/dandanplay';
import { MediaItem } from '@/services/media/types';
import { createContext, useContext } from 'react';
import { SharedValue } from 'react-native-reanimated';

import { EpisodeListDrawerRef } from './EpisodeListDrawer';

export type TrackInfo = {
  name: string;
  index: number;
  language?: string;
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
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  mediaStats?: MediaStats | null;

  showControls: boolean;
  setShowControls: (show: boolean) => void;
  fadeAnim: SharedValue<number>;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  isGestureSeekingActive: SharedValue<boolean>;
  isVolumeGestureActive: SharedValue<boolean>;
  isBrightnessGestureActive: SharedValue<boolean>;
  hideControlsWithDelay: () => void;
  clearControlsTimeout: () => void;
  onCommentsLoaded?: (
    comments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => void;
  danmakuEpisodeInfo?: { animeTitle: string; episodeTitle: string } | undefined;
  danmakuComments: DandanComment[];

  // Episode list related
  episodes: MediaItem[];
  currentItem?: MediaItem | null;
  isMovie: boolean;
  episodeListDrawerRef: React.RefObject<EpisodeListDrawerRef | null>;
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
