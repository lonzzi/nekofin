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
import { DanmakuSearchPanel, type DanmakuSearchPanelRef } from './panels/DanmakuSearchPanel';
import { EpisodePanel } from './panels/EpisodePanel';
import { PlayerPanelHost } from './panels/PlayerPanelHost';
import {
  getActivePlayerPanelRoute,
  INITIAL_PLAYER_PANEL_STATE,
  isPlayerPanelOpen,
  playerPanelReducer,
  type PlayerPanelRoute,
} from './panels/playerPanelRoute';
import { MediaStats, MediaTrack, MediaTracks, PlayerContext } from './PlayerContext';
import { TopControls } from './TopControls';

const PLAYER_CONTROLS_AUTO_HIDE_DELAY_MS = 6000;

type ControlsProps = {
  autoHideControls?: boolean;
  initiallyVisible?: boolean;
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
  autoHideControls = true,
  initiallyVisible = true,
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
  const [showControls, setShowControls] = useState(initiallyVisible);
  const [isDragging, setIsDragging] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const isGestureSeekingActive = useSharedValue(false);
  const isVolumeGestureActive = useSharedValue(false);
  const isBrightnessGestureActive = useSharedValue(false);

  const fadeAnim = useSharedValue(0);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const danmakuSearchPanelRef = useRef<DanmakuSearchPanelRef>(null);
  const activePanel = getActivePlayerPanelRoute(panelState);
  const isPanelOpen = isPlayerPanelOpen(panelState);
  const isPanelOpenRef = useRef(isPanelOpen);
  isPanelOpenRef.current = isPanelOpen;

  const openPanel = useCallback((route: PlayerPanelRoute) => {
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
    danmakuSearchPanelRef.current?.cancelPending();
    dispatchPanel({ type: 'BACK' });
  }, []);
  const closePanel = useCallback(() => {
    danmakuSearchPanelRef.current?.cancelPending();
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

    if (!autoHideControls || isLoading || isPanelOpenRef.current || isScreenReaderEnabled) {
      return;
    }

    controlsTimeout.current = setTimeout(() => {
      if (
        !isDragging &&
        !isPanelOpenRef.current &&
        !isGestureSeekingActive.value &&
        !isVolumeGestureActive.value &&
        !isBrightnessGestureActive.value
      ) {
        scheduleOnRN(setShowControls, false);
      }
    }, PLAYER_CONTROLS_AUTO_HIDE_DELAY_MS);
  }, [
    autoHideControls,
    clearControlsTimeout,
    isDragging,
    isLoading,
    isScreenReaderEnabled,
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
    isPanelOpen,
    openPanel,
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
      : activePanel?.key === 'danmakuSearch'
        ? '搜索弹幕'
        : '弹幕';
  const panelSubtitle =
    activePanel?.key === 'episodes'
      ? currentEpisodeIndex >= 0
        ? `${currentEpisodeIndex + 1} / ${episodes.length}`
        : `${episodes.length} 集`
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
      case 'danmaku':
        return <DanmakuPanel onSearch={handleOpenDanmakuSearch} />;
      case 'danmakuSearch':
        return (
          <DanmakuSearchPanel
            ref={danmakuSearchPanelRef}
            onCommentsLoaded={handleCommentsLoaded}
            onLoaded={closePanel}
          />
        );
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
