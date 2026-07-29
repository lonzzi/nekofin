import { DandanComment } from '@/services/dandanplay';
import { MediaItem } from '@/services/media/types';
import type { HdrStateChangeEvent } from 'expo-mpv';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BottomControls } from './BottomControls';
import { GestureHandler } from './GestureHandler';
import { BottomOverlayGradient, ContentOverlayScrim, TopOverlayGradient } from './OverlayGradients';
import { DanmakuPanel } from './panels/DanmakuPanel';
import { DanmakuSearchPanel } from './panels/DanmakuSearchPanel';
import { EpisodePanel } from './panels/EpisodePanel';
import { PlaybackPanel } from './panels/PlaybackPanel';
import { PlayerPanelHost } from './panels/PlayerPanelHost';
import {
  getActivePlayerPanelRoute,
  INITIAL_PLAYER_PANEL_STATE,
  isPlayerPanelOpen,
  playerPanelReducer,
  type PlayerPanelRootRoute,
  type PlayerPanelRoute,
} from './panels/playerPanelRoute';
import { TrackPanel } from './panels/TrackPanel';
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
  aspectRatio?: string;
  onAspectRatioChange?: (mode: string) => void;
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  mediaStats?: MediaStats | null;
  bufferedProgress?: SharedValue<number>;
  hdrState?: HdrStateChangeEvent | null;
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
  aspectRatio,
  onAspectRatioChange,
  hasPreviousEpisode,
  hasNextEpisode,
  onPreviousEpisode,
  onNextEpisode,
  mediaStats,
  bufferedProgress,
  hdrState,
  onCommentsLoaded,
  danmakuEpisodeInfo,
  danmakuComments,
  episodes,
  currentItem,
  onEpisodeSelect,
}: ControlsProps) {
  const [panelState, dispatchPanel] = useReducer(playerPanelReducer, INITIAL_PLAYER_PANEL_STATE);
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const isGestureSeekingActive = useSharedValue(false);
  const isVolumeGestureActive = useSharedValue(false);
  const isBrightnessGestureActive = useSharedValue(false);

  const fadeAnim = useSharedValue(0);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePanel = getActivePlayerPanelRoute(panelState);
  const isPanelOpen = isPlayerPanelOpen(panelState);

  const openPanel = useCallback((route: PlayerPanelRootRoute) => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
    setShowControls(true);
    dispatchPanel({ type: 'OPEN', route });
  }, []);
  const pushPanel = useCallback((route: PlayerPanelRoute) => {
    dispatchPanel({ type: 'PUSH', route });
  }, []);
  const backPanel = useCallback(() => {
    dispatchPanel({ type: 'BACK' });
  }, []);
  const closePanel = useCallback(() => {
    dispatchPanel({ type: 'CLOSE' });
  }, []);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
  }, []);

  const hideControlsWithDelay = useCallback(() => {
    clearControlsTimeout();

    if (isPanelOpen || isScreenReaderEnabled) {
      return;
    }

    controlsTimeout.current = setTimeout(() => {
      if (
        !isDragging &&
        !isPanelOpen &&
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
    isScreenReaderEnabled,
    isPanelOpen,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
  ]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setIsReduceMotionEnabled);
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      setIsScreenReaderEnabled(enabled);
      if (enabled) setShowControls(true);
    });
    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled,
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
      setIsScreenReaderEnabled(enabled);
      if (enabled) setShowControls(true);
    });

    return () => {
      motionSubscription.remove();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isPanelOpen) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      setShowControls(true);
    } else {
      hideControlsWithDelay();
    }
  }, [isPanelOpen, hideControlsWithDelay, fadeAnim]);

  useEffect(() => {
    closePanel();
  }, [closePanel, currentItem?.id]);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showControls) {
      fadeAnim.value = withTiming(1, { duration: isReduceMotionEnabled ? 0 : 200 });
      hideControlsWithDelay();
    } else {
      fadeAnim.value = withTiming(0, { duration: isReduceMotionEnabled ? 0 : 300 });
      clearControlsTimeout();
    }
  }, [showControls, fadeAnim, hideControlsWithDelay, clearControlsTimeout, isReduceMotionEnabled]);

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
    aspectRatio,
    onAspectRatioChange,
    hasPreviousEpisode,
    hasNextEpisode,
    onPreviousEpisode,
    onNextEpisode,
    mediaStats: mediaStats ?? null,
    bufferedProgress,
    hdrState: hdrState ?? null,
    showControls,
    setShowControls,
    fadeAnim,
    activePanel,
    isPanelOpen,
    openPanel,
    pushPanel,
    backPanel,
    closePanel,
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
    onEpisodeSelect,
  };

  const currentEpisodeIndex = currentItem
    ? episodes.findIndex((episode) => episode.id === currentItem.id)
    : -1;
  const panelTitle =
    activePanel?.key === 'episodes'
      ? '剧集'
      : activePanel?.key === 'tracks'
        ? '字幕与音轨'
        : activePanel?.key === 'playback'
          ? '播放设置'
          : activePanel?.key === 'danmakuSearch'
            ? '搜索弹幕'
            : '弹幕';
  const panelSubtitle =
    activePanel?.key === 'episodes'
      ? currentEpisodeIndex >= 0
        ? `${currentEpisodeIndex + 1} / ${episodes.length}`
        : `${episodes.length} 集`
      : activePanel?.key === 'playback'
        ? `${rate}× · ${aspectRatio === 'fill' ? '铺满' : (aspectRatio ?? '自适应')}`
        : activePanel?.key === 'danmakuSearch'
          ? '手动匹配番剧与剧集'
          : activePanel?.key === 'danmaku'
            ? `${danmakuComments.length} 条弹幕`
            : undefined;

  const handleEpisodeSelect = useCallback(
    (episodeId: string) => {
      closePanel();
      onEpisodeSelect(episodeId);
    },
    [closePanel, onEpisodeSelect],
  );
  const handlePanelRateChange = useCallback(
    (nextRate: number) => onRateChange?.(nextRate),
    [onRateChange],
  );
  const handleOpenDanmakuSearch = useCallback(
    () => pushPanel({ key: 'danmakuSearch' }),
    [pushPanel],
  );
  const handleCommentsLoaded = useCallback(
    (comments: DandanComment[], episodeInfo: { animeTitle: string; episodeTitle: string }) => {
      onCommentsLoaded?.(comments, episodeInfo);
    },
    [onCommentsLoaded],
  );

  const panelContent = (() => {
    switch (activePanel?.key) {
      case 'episodes':
        return (
          <EpisodePanel
            currentItemId={currentItem?.id}
            episodes={episodes}
            onSelectEpisode={handleEpisodeSelect}
          />
        );
      case 'tracks':
        return (
          <TrackPanel
            initialTab={activePanel.tab}
            onAudioTrackChange={onAudioTrackChange}
            onSubtitleTrackChange={onSubtitleTrackChange}
            selectedTracks={selectedTracks}
            tracks={tracks}
          />
        );
      case 'playback':
        return (
          <PlaybackPanel
            aspectRatio={aspectRatio}
            onAspectRatioChange={onAspectRatioChange}
            onRateChange={handlePanelRateChange}
            rate={rate}
          />
        );
      case 'danmaku':
        return <DanmakuPanel onSearch={handleOpenDanmakuSearch} />;
      case 'danmakuSearch':
        return <DanmakuSearchPanel onCommentsLoaded={handleCommentsLoaded} onLoaded={closePanel} />;
      default:
        return null;
    }
  })();

  return (
    <PlayerContext.Provider value={contextValue}>
      <View
        accessibilityElementsHidden={isPanelOpen}
        importantForAccessibility={isPanelOpen ? 'no-hide-descendants' : 'auto'}
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
      >
        <ContentOverlayScrim />
        <TopOverlayGradient />
        <BottomOverlayGradient />
        <GestureHandler />
        <TopControls />
        <BottomControls />
      </View>
      <PlayerPanelHost
        onBack={panelState.stack.length > 1 ? backPanel : undefined}
        onDismiss={closePanel}
        subtitle={panelSubtitle}
        title={panelTitle}
        visible={isPanelOpen}
      >
        {panelContent}
      </PlayerPanelHost>
    </PlayerContext.Provider>
  );
}
