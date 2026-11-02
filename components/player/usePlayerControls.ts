import { useTranslation } from '@/lib/i18n';
import type { DanmakuCommentsData } from '@/services/danmaku';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import type { DanmakuSearchPanelRef } from './panels/DanmakuSearchPanel';
import {
  getActivePlayerPanelRoute,
  INITIAL_PLAYER_PANEL_STATE,
  isPlayerPanelOpen,
  playerPanelReducer,
  type PlayerPanelRoute,
} from './panels/playerPanelRoute';
import type {
  PlayerControlsState,
  PlayerLifecycleState,
  PlayerPanelsState,
  PlayerPlaybackState,
} from './PlayerContext';
import { playerControlsReducer } from './playerControlsState';

const PLAYER_CONTROLS_AUTO_HIDE_DELAY_MS = 6000;

export type PlayerControlsOptions = {
  autoHideControls?: boolean;
  initiallyVisible?: boolean;
};

export function usePlayerControls(
  playback: PlayerPlaybackState,
  lifecycle: PlayerLifecycleState,
  { autoHideControls = true, initiallyVisible = false }: PlayerControlsOptions = {},
): { controls: PlayerControlsState; panels: PlayerPanelsState } {
  const { isLoading, currentItem, onEpisodeSelect, onCommentsLoaded } = playback;
  const overlaysVisible = lifecycle.entryVisible && (Platform.OS !== 'ios' || !lifecycle.isExiting);
  const { t: tr } = useTranslation();
  const [panelState, dispatchPanel] = useReducer(playerPanelReducer, INITIAL_PLAYER_PANEL_STATE);
  const [{ isLocked, showControls, showLockControl }, dispatchControls] = useReducer(
    playerControlsReducer,
    {
      isLocked: false,
      showControls: initiallyVisible,
      showLockControl: false,
    },
  );
  const isLockedRef = useRef(false);
  const isInteractionLocked = useCallback(() => isLockedRef.current, []);
  const [controlsLaidOut, setControlsLaidOut] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const controlsVisible = overlaysVisible && hasEntered && showControls;
  const [isDragging, setIsDragging] = useState(false);
  const seekPreviewTime = useSharedValue(0);
  const seekPreviewStartTime = useSharedValue(0);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const isGestureSeekingActive = useSharedValue(false);
  const isVolumeGestureActive = useSharedValue(false);
  const isBrightnessGestureActive = useSharedValue(false);

  const fadeAnim = useSharedValue(0);
  const lockFadeAnim = useSharedValue(0);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const danmakuSearchPanelRef = useRef<DanmakuSearchPanelRef>(null);
  const [searchNavigation, setSearchNavigation] = useState({
    title: tr('danmaku.findComments'),
    canGoBack: false,
  });
  const activePanel = getActivePlayerPanelRoute(panelState);
  const isPanelOpen = isPlayerPanelOpen(panelState);
  const lockControlVisible =
    overlaysVisible && hasEntered && !isPanelOpen && (isLocked ? showLockControl : showControls);
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
    dispatchControls({ type: 'SET_VISIBLE', visible });
    // A tap can reveal controls while loading without waiting for playback.
    if (visible) setHasEntered(true);
  }, []);

  const openPanel = useCallback((route: PlayerPanelRoute) => {
    if (isLockedRef.current) return;
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
    dispatchControls({ type: 'SET_VISIBLE', visible: true });
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

  const toggleControlsVisibility = useCallback(() => {
    clearControlsTimeout();
    setHasEntered(true);
    dispatchControls({ type: 'TOGGLE_VISIBLE' });
  }, [clearControlsTimeout]);

  const toggleLock = useCallback(() => {
    const locked = !isLockedRef.current;
    isLockedRef.current = locked;
    clearControlsTimeout();
    closePanel();
    setIsDragging(false);
    isGestureSeekingActive.set(false);
    isVolumeGestureActive.set(false);
    isBrightnessGestureActive.set(false);
    dispatchControls({ type: 'SET_LOCKED', locked });
  }, [
    clearControlsTimeout,
    closePanel,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
  ]);

  const hideControlsWithDelay = useCallback(() => {
    clearControlsTimeout();

    if (
      !autoHideControls ||
      (!isLockedRef.current && isLoading) ||
      isPanelOpenRef.current ||
      isScreenReaderEnabled
    ) {
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
        dispatchControls({ type: 'HIDE' });
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
    closePanel();
  }, [closePanel, currentItem?.id]);

  useEffect(() => {
    if (controlsVisible) {
      fadeAnim.value = withTiming(1, {
        duration: isReduceMotionEnabled ? 0 : 280,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    } else {
      fadeAnim.value = withTiming(0, { duration: isReduceMotionEnabled ? 0 : 300 });
    }
  }, [controlsVisible, fadeAnim, isReduceMotionEnabled]);

  useEffect(() => {
    lockFadeAnim.set(
      withTiming(lockControlVisible ? 1 : 0, {
        duration: isReduceMotionEnabled ? 0 : lockControlVisible ? 280 : 300,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [isReduceMotionEnabled, lockControlVisible, lockFadeAnim]);

  useEffect(() => {
    if (controlsVisible || lockControlVisible) hideControlsWithDelay();
    else clearControlsTimeout();
    return clearControlsTimeout;
  }, [
    controlsVisible,
    lockControlVisible,
    isPanelOpen,
    hideControlsWithDelay,
    clearControlsTimeout,
  ]);

  const panelTitle =
    activePanel?.key === 'episodes'
      ? tr('media.series')
      : activePanel?.key === 'danmakuSearch'
        ? searchNavigation.title
        : tr('danmaku.comments');

  const handleEpisodeSelect = useCallback(
    (episodeId: string) => {
      closePanel();
      onEpisodeSelect(episodeId);
    },
    [closePanel, onEpisodeSelect],
  );
  const handleOpenDanmakuSearch = useCallback(() => {
    setSearchNavigation({ title: tr('danmaku.findComments'), canGoBack: false });
    pushPanel({ key: 'danmakuSearch' });
  }, [pushPanel, tr]);
  const handleCommentsLoaded = useCallback(
    (data: DanmakuCommentsData) => {
      onCommentsLoaded?.(data);
    },
    [onCommentsLoaded],
  );

  return {
    controls: {
      overlaysVisible,
      showControls: controlsVisible,
      setShowControls: setControlsVisible,
      showLockControl: lockControlVisible,
      toggleControlsVisibility,
      isLocked,
      onToggleLock: toggleLock,
      isInteractionLocked,
      fadeAnim,
      lockFadeAnim,
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
      onLayout: handleControlsLayout,
    },
    panels: {
      active: activePanel,
      title: panelTitle,
      canGoBack:
        panelState.stack.length > 1 ||
        (activePanel?.key === 'danmakuSearch' && searchNavigation.canGoBack),
      searchRef: danmakuSearchPanelRef,
      onBack: backPanel,
      onDismiss: closePanel,
      onEpisodeSelect: handleEpisodeSelect,
      onSearch: handleOpenDanmakuSearch,
      onCommentsLoaded: handleCommentsLoaded,
      onSearchNavigationChange: setSearchNavigation,
    },
  };
}
