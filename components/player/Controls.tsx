import { DandanComment } from '@/services/dandanplay';
import type { DanmakuCommentsData, DanmakuTrack } from '@/services/danmaku';
import { MediaItem, MediaSource } from '@/services/media/types';
import type { HdrStateChangeEvent } from 'expo-mpv';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import {
  Easing,
  ReduceMotion,
  SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
import { SeekPreview } from './SeekPreview';
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
  mediaSources?: MediaSource[];
  selectedMediaSourceId?: string | null;
  onMediaSourceChange?: (id: string) => void;
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
  mediaSources,
  selectedMediaSourceId,
  onMediaSourceChange,
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
  danmakuTracks,
  danmakuSelection,
  onDanmakuSelectionChange,
  danmakuFailedSources,
  episodes,
  currentItem,
  onEpisodeSelect,
}: ControlsProps) {
  const [panelState, dispatchPanel] = useReducer(playerPanelReducer, INITIAL_PLAYER_PANEL_STATE);
  const [showControls, setShowControls] = useState(initiallyVisible);
  const [controlsLaidOut, setControlsLaidOut] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const controlsVisible = hasEntered && showControls;
  const [isDragging, setIsDragging] = useState(false);
  const seekPreviewTime = useSharedValue(0);
  const seekPreviewStartTime = useSharedValue(0);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const isGestureSeekingActive = useSharedValue(false);
  const isVolumeGestureActive = useSharedValue(false);
  const isBrightnessGestureActive = useSharedValue(false);

  const fadeAnim = useSharedValue(0);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const danmakuSearchPanelRef = useRef<DanmakuSearchPanelRef>(null);
  const [searchNavigation, setSearchNavigation] = useState({ title: '搜索弹幕', canGoBack: false });
  const activePanel = getActivePlayerPanelRoute(panelState);
  const isPanelOpen = isPlayerPanelOpen(panelState);
  const isPanelOpenRef = useRef(isPanelOpen);
  isPanelOpenRef.current = isPanelOpen;

  const handleControlsLayout = useCallback(() => {
    setControlsLaidOut(true);
  }, []);

  useEffect(() => {
    if (!initiallyVisible || !controlsLaidOut || isLoading || hasEntered) return;
    // Start the first reveal after playback initialization has released the UI
    // thread. Later buffering must not replay this entrance.
    // Let the native glass mount with no material before animating it in.
    // Fading a zero-opacity ancestor would prevent GlassView from rendering.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setHasEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [initiallyVisible, controlsLaidOut, isLoading, hasEntered]);

  const setControlsVisible = useCallback((visible: boolean) => {
    setShowControls(visible);
    // A tap can reveal controls while loading without waiting for playback.
    if (visible) setHasEntered(true);
  }, []);

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
    if (danmakuSearchPanelRef.current?.goBack()) return;
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
      if (enabled) setControlsVisible(true);
    });
    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled,
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
      setIsScreenReaderEnabled(enabled);
      if (enabled) setControlsVisible(true);
    });

    return () => {
      motionSubscription.remove();
      subscription.remove();
    };
  }, [setControlsVisible]);

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
    if (controlsVisible) {
      fadeAnim.value = withTiming(1, {
        duration: isReduceMotionEnabled ? 0 : 280,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
      hideControlsWithDelay();
    } else {
      fadeAnim.value = withTiming(0, { duration: isReduceMotionEnabled ? 0 : 300 });
      clearControlsTimeout();
    }
  }, [
    controlsVisible,
    fadeAnim,
    hideControlsWithDelay,
    clearControlsTimeout,
    isReduceMotionEnabled,
  ]);

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
    mediaSources,
    selectedMediaSourceId,
    onMediaSourceChange,
    aspectRatio,
    onAspectRatioChange,
    hasPreviousEpisode,
    hasNextEpisode,
    onPreviousEpisode,
    onNextEpisode,
    mediaStats: mediaStats ?? null,
    bufferedProgress,
    hdrState: hdrState ?? null,
    showControls: controlsVisible,
    setShowControls: setControlsVisible,
    fadeAnim,
    isPanelOpen,
    openPanel,
    isDragging,
    seekPreviewTime,
    seekPreviewStartTime,
    setIsDragging,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
    hideControlsWithDelay,
    clearControlsTimeout,
    onCommentsLoaded,
    danmakuEpisodeInfo,
    danmakuComments,
    danmakuTracks,
    danmakuSelection,
    onDanmakuSelectionChange,
    danmakuFailedSources,
    episodes,
    currentItem,
    isMovie: currentItem?.type === 'Movie',
    onEpisodeSelect,
  };

  const panelTitle =
    activePanel?.key === 'episodes'
      ? '剧集'
      : activePanel?.key === 'danmakuSearch'
        ? searchNavigation.title
        : '弹幕';

  const handleEpisodeSelect = useCallback(
    (episodeId: string) => {
      closePanel();
      onEpisodeSelect(episodeId);
    },
    [closePanel, onEpisodeSelect],
  );
  const handleOpenDanmakuSearch = useCallback(() => {
    setSearchNavigation({ title: '搜索弹幕', canGoBack: false });
    pushPanel({ key: 'danmakuSearch' });
  }, [pushPanel]);
  const handleCommentsLoaded = useCallback(
    (data: DanmakuCommentsData) => {
      onCommentsLoaded?.(data);
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
            onNavigationChange={setSearchNavigation}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <PlayerContext.Provider value={contextValue}>
      <View
        accessibilityElementsHidden={isPanelOpen || !hasEntered}
        importantForAccessibility={isPanelOpen || !hasEntered ? 'no-hide-descendants' : 'auto'}
        onLayout={handleControlsLayout}
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
      >
        <ContentOverlayScrim />
        <TopOverlayGradient />
        <BottomOverlayGradient />
        <GestureHandler />
        <TopControls />
        <BottomControls />
        <SeekPreview />
      </View>
      <PlayerPanelHost
        onBack={
          panelState.stack.length > 1 ||
          (activePanel?.key === 'danmakuSearch' && searchNavigation.canGoBack)
            ? backPanel
            : undefined
        }
        onDismiss={closePanel}
        title={panelTitle}
        visible={isPanelOpen}
      >
        {panelContent}
      </PlayerPanelHost>
    </PlayerContext.Provider>
  );
}
