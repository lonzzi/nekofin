import { DandanComment } from '@/services/dandanplay';
import { MediaItem } from '@/services/media/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BottomControls } from './BottomControls';
import { EpisodeListDrawer, EpisodeListDrawerRef } from './EpisodeListDrawer';
import { GestureHandler } from './GestureHandler';
import { BottomOverlayGradient, TopOverlayGradient } from './OverlayGradients';
import { MediaStats, MediaTrack, MediaTracks, PlayerContext } from './PlayerContext';
import { TopControls } from './TopControls';

type ControlsProps = {
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
  onCommentsLoaded?: (
    comments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => void;
  danmakuEpisodeInfo?: { animeTitle: string; episodeTitle: string } | undefined;
  danmakuComments: DandanComment[];
  episodes: MediaItem[];
  currentItem?: MediaItem | null;
  onEpisodeSelect: (episodeId: string) => void;
};

export function Controls({
  isPlaying,
  isLoading,
  duration,
  currentTime,
  onSeek,
  title,
  onPlayPause,
  onRateChange,
  rate,
  tracks,
  selectedTracks,
  onAudioTrackChange,
  onSubtitleTrackChange,
  hasPreviousEpisode,
  hasNextEpisode,
  onPreviousEpisode,
  onNextEpisode,
  mediaStats,
  onCommentsLoaded,
  danmakuEpisodeInfo,
  danmakuComments,
  episodes,
  currentItem,
  onEpisodeSelect,
}: ControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const episodeListDrawerRef = useRef<EpisodeListDrawerRef | null>(null);
  const isGestureSeekingActive = useSharedValue(false);
  const isVolumeGestureActive = useSharedValue(false);
  const isBrightnessGestureActive = useSharedValue(false);

  const fadeAnim = useSharedValue(1);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
  }, []);

  const hideControlsWithDelay = useCallback(() => {
    clearControlsTimeout();

    if (menuOpen) {
      return;
    }

    controlsTimeout.current = setTimeout(() => {
      if (
        !isDragging &&
        !menuOpen &&
        !isGestureSeekingActive.value &&
        !isVolumeGestureActive.value &&
        !isBrightnessGestureActive.value
      ) {
        scheduleOnRN(setShowControls, false);
      }
    }, 3000);
  }, [
    clearControlsTimeout,
    isDragging,
    menuOpen,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
  ]);

  useEffect(() => {
    if (menuOpen) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      setShowControls(true);
    } else {
      hideControlsWithDelay();
    }
  }, [menuOpen, hideControlsWithDelay, fadeAnim]);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showControls) {
      fadeAnim.value = withTiming(1, { duration: 200 });
      hideControlsWithDelay();
    } else {
      fadeAnim.value = withTiming(0, { duration: 300 });
      clearControlsTimeout();
    }
  }, [showControls, fadeAnim, hideControlsWithDelay, clearControlsTimeout]);

  const contextValue = {
    title,
    isPlaying,
    isLoading,
    duration,
    currentTime,
    onSeek,
    onPlayPause,
    onRateChange,
    rate,
    tracks,
    selectedTracks,
    onAudioTrackChange,
    onSubtitleTrackChange,
    hasPreviousEpisode,
    hasNextEpisode,
    onPreviousEpisode,
    onNextEpisode,
    mediaStats: mediaStats ?? null,
    showControls,
    setShowControls,
    fadeAnim,
    menuOpen,
    setMenuOpen,
    isDragging,
    setIsDragging,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
    hideControlsWithDelay,
    clearControlsTimeout,
    onCommentsLoaded,
    danmakuEpisodeInfo,
    danmakuComments,
    episodes,
    currentItem,
    isMovie: currentItem?.type === 'Movie',
    episodeListDrawerRef,
    onEpisodeSelect,
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      <EpisodeListDrawer ref={episodeListDrawerRef} />
      <TopOverlayGradient />
      <BottomOverlayGradient />
      <TopControls />
      <BottomControls />
      <GestureHandler />
    </PlayerContext.Provider>
  );
}
