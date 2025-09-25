import { StrokeTextView } from '@/modules/stroke-text';
import { DANDAN_COMMENT_MODE } from '@/services/dandanplay';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ActiveBullet } from './DanmakuTypes';

const STROKE_COLOR = '#000';
const STROKE_WIDTH = 1.6;

export function Bullet({
  width,
  data,
  onExpire,
  fontSize,
  fontFamily,
  fontWeight,
  isPlaying,
  playbackRate,
}: {
  width: number;
  data: ActiveBullet;
  onExpire: (id: number) => void;
  fontSize: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
  isPlaying: boolean;
  playbackRate: number;
}) {
  const isScroll = useMemo(
    () =>
      data.mode === DANDAN_COMMENT_MODE.Scroll || data.mode === DANDAN_COMMENT_MODE.ScrollBottom,
    [data.mode],
  );

  const initTranslateX = useMemo(() => {
    if (isScroll) {
      const clampedOffset = Math.max(0, Math.min(data.startOffsetMs || 0, data.durationMs));
      const progressed = Math.max(0, Math.min(1, clampedOffset / data.durationMs));

      const startX = data.mode === DANDAN_COMMENT_MODE.Scroll ? width : -100;
      const endX =
        data.mode === DANDAN_COMMENT_MODE.Scroll
          ? -(data.textWidth || 0) - 300
          : width + (data.textWidth || 0) + 300;

      const totalDistance = endX - startX;
      return startX + totalDistance * progressed;
    } else {
      return 0;
    }
  }, [isScroll, data.startOffsetMs, data.durationMs, data.textWidth, width, data.mode]);

  const translateX = useSharedValue(initTranslateX);

  const originalDurationRef = useRef<number>(data.durationMs);
  const remainingDurationRef = useRef<number>(data.durationMs);
  const runStartedAtRef = useRef<number | null>(null);
  const removeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRateRef = useRef<number>(playbackRate);

  const isInitializedRef = useRef(false);

  useEffect(() => {
    originalDurationRef.current = data.durationMs;
    const clampedOffset = Math.max(0, Math.min(data.startOffsetMs || 0, data.durationMs));
    remainingDurationRef.current = Math.max(0, data.durationMs - clampedOffset);

    if (!isInitializedRef.current) {
      translateX.value = initTranslateX;
      isInitializedRef.current = true;
    }
  }, [data.durationMs, data.startOffsetMs, width, translateX, initTranslateX]);

  const handleExpire = useCallback(() => {
    onExpire(data.id);
  }, [data.id, onExpire]);

  const scheduleFadeAndRemoval = useCallback(() => {
    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

    if (remainingDurationRef.current > 0) {
      removeTimeoutRef.current = setTimeout(() => {
        handleExpire();
      }, remainingDurationRef.current);
    } else {
      handleExpire();
    }
  }, [handleExpire]);

  const startOrResume = useCallback(() => {
    if (runStartedAtRef.current != null) return;
    runStartedAtRef.current = Date.now();
    scheduleFadeAndRemoval();

    if (isScroll) {
      const totalDistance =
        data.mode === DANDAN_COMMENT_MODE.Scroll
          ? -(data.textWidth || 0) - 300
          : width + (data.textWidth || 0) + 300;
      const remaining = remainingDurationRef.current;

      if (remaining <= 0) {
        handleExpire();
        return;
      }

      translateX.value = withTiming(totalDistance, {
        duration: Math.max(100, remaining),
        easing: Easing.linear,
      });
    }
  }, [
    scheduleFadeAndRemoval,
    isScroll,
    data.mode,
    data.textWidth,
    width,
    translateX,
    handleExpire,
  ]);

  const pauseRun = useCallback(() => {
    if (runStartedAtRef.current == null) return;
    const elapsed = Date.now() - runStartedAtRef.current;
    runStartedAtRef.current = null;

    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

    remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed);

    cancelAnimation(translateX);
  }, [translateX]);

  useEffect(() => {
    if (isPlaying) {
      startOrResume();
    } else {
      pauseRun();
    }
    return () => {
      if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
    };
  }, [isPlaying, startOrResume, pauseRun, translateX]);

  useEffect(() => {
    const oldRate = Math.max(0.25, prevRateRef.current || 1);
    const newRate = Math.max(0.25, playbackRate || 1);
    if (oldRate === newRate) return;

    const scale = oldRate / newRate;

    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

    if (runStartedAtRef.current != null) {
      const elapsed = Date.now() - runStartedAtRef.current;
      runStartedAtRef.current = null;
      remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed);
    }

    remainingDurationRef.current = Math.max(0, Math.round(remainingDurationRef.current * scale));

    if (isScroll) {
      const totalDistance =
        data.mode === DANDAN_COMMENT_MODE.Scroll
          ? -(data.textWidth || 0) - 300
          : width + (data.textWidth || 0) + 300;

      const remaining = remainingDurationRef.current;
      if (remaining <= 0) {
        handleExpire();
        return;
      }

      cancelAnimation(translateX);

      runStartedAtRef.current = Date.now();
      scheduleFadeAndRemoval();

      translateX.value = withTiming(totalDistance, {
        duration: Math.max(100, remaining),
        easing: Easing.linear,
      });
    } else {
      runStartedAtRef.current = Date.now();
      scheduleFadeAndRemoval();
    }

    prevRateRef.current = newRate;
  }, [
    playbackRate,
    isScroll,
    data.textWidth,
    width,
    translateX,
    handleExpire,
    scheduleFadeAndRemoval,
    data.mode,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const shouldTranslate = isScroll;

    if (shouldTranslate) {
      return {
        position: 'absolute' as const,
        top: data.top,
        left: 0,
        transform: [{ translateX: translateX.value }],
      };
    } else {
      return {
        position: 'absolute' as const,
        top: data.top,
        left: 0,
        transform: [],
      };
    }
  }, [data.top, isScroll]);

  const isTopOrBottom =
    data.mode === DANDAN_COMMENT_MODE.Top || data.mode === DANDAN_COMMENT_MODE.Bottom;

  return (
    <Animated.View style={[animatedStyle, { width: '100%' }]} renderToHardwareTextureAndroid>
      <StrokeTextView
        text={data.text}
        color={data.colorHex}
        strokeColor={STROKE_COLOR}
        strokeWidth={STROKE_WIDTH}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily={fontFamily}
        textAlign={isTopOrBottom ? 'center' : 'left'}
      />
    </Animated.View>
  );
}
